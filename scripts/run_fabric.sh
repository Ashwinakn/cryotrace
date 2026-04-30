#!/bin/bash
set -e
echo "Fetching Hyperledger Fabric binaries and samples..."
if [ ! -d "fabric-samples" ]; then
    curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
    ./install-fabric.sh docker samples binary
fi

cd fabric-samples/test-network

echo "Bringing down any existing network..."
./network.sh down

echo "Bringing up the network with a channel..."
./network.sh up createChannel -c mychannel -ca

echo "Deploying the CryoTrace chaincode..."
./network.sh deployCC -ccn cryotrace -ccp ../../fabric-network/chaincode/cryotrace -ccl go -c mychannel

echo "Fabric network is up and chaincode is deployed!"
