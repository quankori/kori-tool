import { config } from "dotenv";
import abi from "../abi.json";
import { NonceManager } from "@ethersproject/experimental";
import { Wallet } from "@ethersproject/wallet";
import { ethers, utils } from "ethers";
config({});

const cfg = {
  smc: process.env.SMART_CONTRACT || "",
  key: process.env.PRIVATE_KEY || "",
  rpc: process.env.RPC_ENDPOINT || "",
};

async function getSinger() {
  const walletPrivateKey = new Wallet(cfg.key);
  const instance = new ethers.providers.JsonRpcProvider(cfg.rpc);
  const signer = walletPrivateKey.connect(instance);
  const managedSigner = new NonceManager(signer);
  return managedSigner;
}

async function getContract() {
  const signer = await getSinger();
  const contract = new ethers.Contract(cfg.smc, abi, signer);
  return contract;
}

(async () => {
  const contract = await getContract();

  console.log(cfg.rpc)
  // Code here
  const result = await contract.launchTime();
  console.log(result)
})();
