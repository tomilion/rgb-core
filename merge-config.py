#!/usr/bin/python3
import json
import os

def readFile(filename):
    file = open(filename, "r")
    contents = json.loads(file.read())
    file.close()
    return contents

def writeFile(filename, contents):
    file = open(filename, "w")
    file.write(contents)
    file.close()

def deleteFile(filename):
    os.remove(filename)

config = readFile("config/default/config.json")
forgingInfo = readFile("config/default/forging_info.json")
password = readFile("config/default/password.json")

config["forging"]["delegates"] = forgingInfo
config["forging"]["defaultPassword"] = password["defaultPassword"]

writeFile("config/default/config.json", json.dumps(config, indent=4))

deleteFile("config/default/forging_info.json")
deleteFile("config/default/password.json")
