import token_abi from "../abi.json";
import factory_abi from "../factory.json";
import pair_abi from "../pair.json";
import { ethers, utils } from "ethers";
import axios from "axios";
import * as fs from "fs-extra";

enum Type {
  BUY = "BUY",
  SELL = "SELL",
}

async function getProvider() {
  return new ethers.providers.JsonRpcProvider(
    "https://bsc-dataseed1.binance.org"
  );
}

async function getContract(tokenAddress: string, abi: any) {
  const provider = await getProvider();
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  return contract;
}

async function getHistory(
  pairAddress: string,
  routerAddress: string,
  price: any,
  fromBlock: number,
  toBlock: number
) {
  let results: any = [];
  const contract = await getContract(pairAddress, pair_abi);
  let eventFilter = contract.filters.Swap();
  let events = await contract.queryFilter(eventFilter, fromBlock, toBlock);
  for (let index = 0; index < events.length; index++) {
    const element = events[index];
    const args: any = element.args;
    if (args["sender"] === args["to"]) {
      continue;
    }
    const type = Number(utils.formatEther(args["amount0In"])) !== 0
      ? Type.SELL
      : Type.BUY;
    const mainAmount =
      type === Type.BUY
        ? Number(utils.formatEther(args["amount0Out"]))
        : Number(utils.formatEther(args["amount1Out"]));
    const subAmount =
      type === Type.BUY
        ? Number(utils.formatEther(args["amount1In"]))
        : Number(utils.formatEther(args["amount0In"]));
    const maker =
      type === Type.BUY ? args["to"].toString() : args["sender"].toString();
    const object = {
      maker: maker,
      mainAmount: mainAmount,
      subAmount: subAmount,
      type: type,
      priceBNB: price.BNB * subAmount,
    };
    results.push(object);
  }
  return results;
}

async function getPriceBNB(subTokenaddress: string) {
  const contract = await getContract(subTokenaddress, token_abi);
  const symbol = await contract.symbol();
  const resultApi = await axios.get(
    `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=bnb`
  );
  return resultApi.data;
}

(async () => {
  // Address infomation
  let mainTokenAddress = "0x9d9f777d0f9c1dc2851606611822ba002665e0bf"; // From token A
  let subTokenAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // To token B
  let factoryAddress = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"; // Address pancakeswap factory, don't change it
  let pairAddress = "";
  let routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

  // find pair
  const factoryContract = await getContract(factoryAddress, factory_abi);
  pairAddress = await factoryContract.getPair(
    mainTokenAddress,
    subTokenAddress
  );

  // Get BNB price for token subToken
  const price = await getPriceBNB(subTokenAddress);

  // Result total
  let results: any = [];

  // Get current block
  const provider = await getProvider();
  const currentBlock = await provider.getBlockNumber();
  let current = currentBlock;
  for (let index = current; index > 0; index -= 500) {
    if (results.length > 1000) break;
    let toBlock = current;
    current = index - 500;
    let fromBlock = current;
    if (toBlock !== currentBlock) {
      toBlock--;
    }
    // Get history
    const history = await getHistory(
      pairAddress,
      routerAddress,
      price,
      fromBlock,
      toBlock
    );
    results.push(...history);
  }
  const addressPath = `${process.cwd()}/info.json`;
  await fs.writeFile(addressPath, JSON.stringify(results, null, 2));
})();
