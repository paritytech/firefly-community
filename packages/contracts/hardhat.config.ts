// MUST be first: raises micro-eth-signer's EIP-3860 init-code limit (inapplicable
// to PolkaVM) before any module loads the signer. See the file for the full why.
import './patches/allow-large-initcode.cjs';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import '@parity/hardhat-polkadot';
import { HardhatUserConfig } from 'hardhat/config';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  resolc: {
    compilerSource: 'binary',
    settings: {
      resolcPath: './bin/resolc',
      memoryConfig: {
        heapSize: 128000,
        stackSize: 128000,
      },
    },
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
      blockGasLimit: 16777216,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    // Paseo Next V2 testnet — set a deployer key in .env. Prefer an Ethereum-style
    // (secp256k1, BIP-44 m/44'/60') MNEMONIC; falls back to a raw PRIVATE_KEY.
    // NOTE: a Substrate/Polkadot (sr25519) seed cannot sign EVM txs and won't work here.
    paseo: {
      url: process.env.PASEO_RPC_URL || 'https://eth-rpc-paseo-next.polkadot.io',
      chainId: 420420417,
      accounts: process.env.MNEMONIC
        ? { mnemonic: process.env.MNEMONIC, path: "m/44'/60'/0'/0", count: 1 }
        : process.env.PRIVATE_KEY
          ? [process.env.PRIVATE_KEY]
          : [],
      polkadot: {
        target: 'pvm',
      },
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  etherscan: {
    apiKey: {
      paseo: 'dummy',
    },
    customChains: [
      {
        network: 'paseo',
        chainId: 420420417,
        urls: {
          apiURL: 'https://blockscout-testnet.polkadot.io/api',
          browserURL: 'https://blockscout-testnet.polkadot.io',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: './typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
