#!/bin/bash

# Generate new genesis block
./bin/run genesis-block:create --output config/default

# Prepare config
python3 merge-config.py

# Install config
rm -rf ~/.lisk/your-place/*
mkdir ~/.lisk/your-place/config
mkdir ~/.lisk/your-place/config/default
cp config/default/config.json ~/.lisk/your-place/config/default/config.json
cp config/default/genesis_block.json ~/.lisk/your-place/config/default/genesis_block.json
mv config/default/accounts.json .secrets/default/accounts.json
