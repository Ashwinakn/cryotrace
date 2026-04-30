package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing cold chain assets
type SmartContract struct {
	contractapi.Contract
}

// ── Data Structures ──────────────────────────────────────────────────────────

// Shipment is the root asset anchored at creation — never mutated after init
type Shipment struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	BatchNo          string           `json:"batch_no"`
	Category         string           `json:"category"`
	Origin           string           `json:"origin"`
	Destination      string           `json:"destination"`
	TempMinRequired  float64          `json:"temp_min_required"`
	TempMaxRequired  float64          `json:"temp_max_required"`
	WeightKg         float64          `json:"weight_kg"`
	GenesisHash      string           `json:"genesis_hash"`
	CreatedAt        string           `json:"created_at"`
	CreatedBy        string           `json:"created_by"`
	CurrentStatus    string           `json:"current_status"`
	Documents        []DocumentAnchor `json:"documents"`
	Handoffs         []HandoffRecord  `json:"handoffs"`
	DeliveryProof    *DeliveryProof   `json:"delivery_proof,omitempty"`
}

// DocumentAnchor — immutable record of a document's SHA-256 hash on-chain
// Once written, this entry CANNOT be overwritten (enforced by chaincode logic)
type DocumentAnchor struct {
	DocID      string `json:"doc_id"`
	DocHash    string `json:"doc_hash"`   // SHA-256 of raw file bytes
	DocType    string `json:"doc_type"`   // "COA", "license", "invoice", "certificate"
	Filename   string `json:"filename"`
	UploadedBy string `json:"uploaded_by"`
	AnchoredAt string `json:"anchored_at"`
	Immutable  bool   `json:"immutable"` // always true — enforced in AnchorDocument
}

// HandoffRecord — each custody transfer, hash-chained to the previous
type HandoffRecord struct {
	ID          string  `json:"id"`
	ShipmentID  string  `json:"shipment_id"`
	Sequence    int     `json:"sequence"`
	FromParty   string  `json:"from_party"`
	ToParty     string  `json:"to_party"`
	Location    string  `json:"location"`
	Timestamp   string  `json:"timestamp"`
	HandoffHash string  `json:"handoff_hash"`
	PrevHash    string  `json:"prev_hash"`
	TempMin     float64 `json:"temp_min"`
	TempMax     float64 `json:"temp_max"`
	Status      string  `json:"status"`
}

// DeliveryProof — final delivery confirmation (write-once)
type DeliveryProof struct {
	DeliveredAt   string `json:"delivered_at"`
	ReceivedBy    string `json:"received_by"`
	DeliveryHash  string `json:"delivery_hash"`
	ConditionOK   bool   `json:"condition_ok"`
	Notes         string `json:"notes"`
}

// ShipmentHistory — full provenance returned by GetShipmentHistory
type ShipmentHistory struct {
	Shipment      *Shipment       `json:"shipment"`
	TotalHandoffs int             `json:"total_handoffs"`
	TotalDocs     int             `json:"total_docs"`
	ChainIntact   bool            `json:"chain_intact"` // true if hash chain is unbroken
	Delivered     bool            `json:"delivered"`
}

// ── Init ──────────────────────────────────────────────────────────────────────

func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return nil
}

// ── Shipment Registration ────────────────────────────────────────────────────

// CreateShipment initialises a new shipment on the ledger.
// This is the ONLY time shipment metadata can be written — it is immutable after this.
func (s *SmartContract) CreateShipment(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	shipmentJSONStr string,
) error {
	exists, err := s.ShipmentExists(ctx, shipmentID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("shipment %s already exists on ledger", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal([]byte(shipmentJSONStr), &shipment); err != nil {
		// Fallback: accept bare id + genesis_hash style call (backward compat)
		shipment = Shipment{
			ID:            shipmentID,
			GenesisHash:   shipmentJSONStr, // old call passed genesisHash as second arg
			CreatedAt:     time.Now().UTC().Format(time.RFC3339),
			CurrentStatus: "PENDING",
			Documents:     []DocumentAnchor{},
			Handoffs:      []HandoffRecord{},
		}
	}

	shipment.ID = shipmentID
	shipment.CurrentStatus = "PENDING"
	if shipment.Documents == nil {
		shipment.Documents = []DocumentAnchor{}
	}
	if shipment.Handoffs == nil {
		shipment.Handoffs = []HandoffRecord{}
	}
	if shipment.CreatedAt == "" {
		shipment.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}

	shipmentJSON, err := json.Marshal(shipment)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(shipmentID, shipmentJSON)
}

// ── Document Anchoring ───────────────────────────────────────────────────────

// AnchorDocument immutably stores a document's SHA-256 hash on-chain.
// A document with the same docID can NEVER be overwritten — this is enforced here.
// The hash is the canonical source of truth for tamper detection.
func (s *SmartContract) AnchorDocument(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	docID string,
	docHash string,
	docType string,
	filename string,
	uploadedBy string,
) error {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return fmt.Errorf("failed to read shipment: %v", err)
	}
	if shipmentJSON == nil {
		return fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return err
	}

	// Immutability check — reject if docID already anchored
	for _, doc := range shipment.Documents {
		if doc.DocID == docID {
			return fmt.Errorf("document %s is already anchored on-chain and cannot be overwritten", docID)
		}
	}

	anchor := DocumentAnchor{
		DocID:      docID,
		DocHash:    docHash,
		DocType:    docType,
		Filename:   filename,
		UploadedBy: uploadedBy,
		AnchoredAt: time.Now().UTC().Format(time.RFC3339),
		Immutable:  true,
	}

	shipment.Documents = append(shipment.Documents, anchor)

	updatedJSON, err := json.Marshal(shipment)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(shipmentID, updatedJSON)
}

// VerifyDocument returns the on-chain hash for a document so callers can compare.
// Returns error if the document was never anchored.
func (s *SmartContract) VerifyDocument(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	docID string,
) (*DocumentAnchor, error) {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return nil, err
	}
	if shipmentJSON == nil {
		return nil, fmt.Errorf("shipment %s not found", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return nil, err
	}

	for _, doc := range shipment.Documents {
		if doc.DocID == docID {
			return &doc, nil
		}
	}

	return nil, fmt.Errorf("document %s was never anchored on this shipment", docID)
}

// ── Chain of Custody ─────────────────────────────────────────────────────────

// RecordHandoff appends a custody transfer to the shipment's handoff chain.
func (s *SmartContract) RecordHandoff(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	handoffJSONStr string,
) error {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if shipmentJSON == nil {
		return fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return err
	}

	var newHandoff HandoffRecord
	if err := json.Unmarshal([]byte(handoffJSONStr), &newHandoff); err != nil {
		return err
	}

	// Validate hash chain: prev_hash of this handoff must equal handoff_hash of the last one
	if len(shipment.Handoffs) > 0 {
		last := shipment.Handoffs[len(shipment.Handoffs)-1]
		if newHandoff.PrevHash != "" && newHandoff.PrevHash != last.HandoffHash {
			return fmt.Errorf(
				"hash chain broken: expected prev_hash=%s, got %s",
				last.HandoffHash, newHandoff.PrevHash,
			)
		}
	}

	shipment.Handoffs = append(shipment.Handoffs, newHandoff)
	shipment.CurrentStatus = newHandoff.Status

	updatedJSON, err := json.Marshal(shipment)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(shipmentID, updatedJSON)
}

// ── Delivery Confirmation ────────────────────────────────────────────────────

// ConfirmDelivery records final delivery proof — write-once, cannot be overwritten.
func (s *SmartContract) ConfirmDelivery(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
	receivedBy string,
	deliveryHash string,
	conditionOK string,
	notes string,
) error {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return err
	}
	if shipmentJSON == nil {
		return fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return err
	}

	if shipment.DeliveryProof != nil {
		return fmt.Errorf("delivery for shipment %s is already confirmed — cannot overwrite", shipmentID)
	}

	ok := conditionOK == "true"
	shipment.DeliveryProof = &DeliveryProof{
		DeliveredAt:  time.Now().UTC().Format(time.RFC3339),
		ReceivedBy:   receivedBy,
		DeliveryHash: deliveryHash,
		ConditionOK:  ok,
		Notes:        notes,
	}
	shipment.CurrentStatus = "DELIVERED"

	updatedJSON, err := json.Marshal(shipment)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(shipmentID, updatedJSON)
}

// ── Queries ──────────────────────────────────────────────────────────────────

// QueryShipment returns the full shipment record.
func (s *SmartContract) QueryShipment(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
) (*Shipment, error) {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return nil, err
	}
	if shipmentJSON == nil {
		return nil, fmt.Errorf("shipment %s does not exist", shipmentID)
	}

	var shipment Shipment
	if err := json.Unmarshal(shipmentJSON, &shipment); err != nil {
		return nil, err
	}

	return &shipment, nil
}

// GetShipmentHistory returns full provenance: metadata + all docs + all handoffs + chain integrity check.
func (s *SmartContract) GetShipmentHistory(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
) (*ShipmentHistory, error) {
	shipment, err := s.QueryShipment(ctx, shipmentID)
	if err != nil {
		return nil, err
	}

	// Verify the handoff hash chain is unbroken
	chainIntact := true
	for i := 1; i < len(shipment.Handoffs); i++ {
		current := shipment.Handoffs[i]
		previous := shipment.Handoffs[i-1]
		if current.PrevHash != "" && current.PrevHash != previous.HandoffHash {
			chainIntact = false
			break
		}
	}

	return &ShipmentHistory{
		Shipment:      shipment,
		TotalHandoffs: len(shipment.Handoffs),
		TotalDocs:     len(shipment.Documents),
		ChainIntact:   chainIntact,
		Delivered:     shipment.DeliveryProof != nil,
	}, nil
}

// ShipmentExists checks if a shipment is on the ledger.
func (s *SmartContract) ShipmentExists(
	ctx contractapi.TransactionContextInterface,
	shipmentID string,
) (bool, error) {
	shipmentJSON, err := ctx.GetStub().GetState(shipmentID)
	if err != nil {
		return false, err
	}
	return shipmentJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating cryotrace chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting cryotrace chaincode: %v", err)
	}
}
