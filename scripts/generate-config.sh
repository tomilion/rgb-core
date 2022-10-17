#!/bin/bash
source .env

if [[ -z "${LISK_DIR}" ]]; then
    echo "Missing LISK_DIR environment variable"
    exit 1
fi

# Generate new genesis block
./bin/run genesis-block:create --output config/default

# Prepare config
python3 merge-config.py

# Install config
rm -rf ${LISK_DIR}
mkdir -p ${LISK_DIR}/config/default
cp config/default/config.json ${LISK_DIR}/config/default/config.json
cp config/default/genesis_block.json ${LISK_DIR}/config/default/genesis_block.json
mv config/default/accounts.json .secrets/default/accounts.json
