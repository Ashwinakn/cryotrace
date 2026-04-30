# setup.ps1
# This script sets up the Hyperledger Fabric test network and deploys the chaincode.
# Note: This relies on WSL2 being properly configured and Docker Desktop running.

Write-Host "Setting up Hyperledger Fabric Test Network..." -ForegroundColor Cyan

# Ensure we are running inside WSL/Bash to run the official scripts
$wsl_check = wsl --status
if ($LASTEXITCODE -ne 0) {
    Write-Host "WSL is not running or installed properly. Please ensure WSL2 and Docker are running." -ForegroundColor Red
    exit 1
}

# The actual setup commands will run via WSL
$bash_script = @"
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
"@

# Write the bash script to a temp file and execute it
Set-Content -Path ".\run_fabric.sh" -Value $bash_script
wsl dos2unix ./run_fabric.sh
wsl bash ./run_fabric.sh
