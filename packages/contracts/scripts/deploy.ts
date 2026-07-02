import { ethers, upgrades, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface ContractDeployment {
  proxy: string;
  implementation: string;
}

interface DeploymentInfo {
  network: string;
  chainId: number;
  deployer: string;
  timestamp: string;
  contracts: {
    BountyEscrow: ContractDeployment;
    FireflyReputation: ContractDeployment;
    MockERC20?: { address: string };
    CrowdstackingPool?: ContractDeployment;
    OutletRegistry?: ContractDeployment;
    ContributorRegistry?: ContractDeployment;
    AllianceGovernance?: ContractDeployment;
  };
}

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error('No deployer account available');
  }
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const isTestnet = networkName !== 'mainnet' && networkName !== 'polkadot';

  console.log('Deploying contracts with account:', deployer.address);
  console.log('Network:', networkName);
  console.log('Chain ID:', chainId);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log('Is Testnet:', isTestnet);
  console.log('');

  // =========================================================================
  // Existing Contracts
  // =========================================================================

  // Deploy BountyEscrow
  console.log('Deploying BountyEscrow...');
  const BountyEscrow = await ethers.getContractFactory('BountyEscrow');
  const escrow = await upgrades.deployProxy(BountyEscrow, [deployer.address], {
    initializer: 'initialize',
  });
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  const escrowImplAddress = await upgrades.erc1967.getImplementationAddress(escrowAddress);

  console.log('BountyEscrow proxy deployed to:', escrowAddress);
  console.log('BountyEscrow implementation:', escrowImplAddress);
  console.log('');

  // Deploy FireflyReputation
  console.log('Deploying FireflyReputation...');
  const FireflyReputation = await ethers.getContractFactory('FireflyReputation');
  const reputation = await upgrades.deployProxy(FireflyReputation, [deployer.address], {
    initializer: 'initialize',
  });
  await reputation.waitForDeployment();

  const reputationAddress = await reputation.getAddress();
  const reputationImplAddress = await upgrades.erc1967.getImplementationAddress(reputationAddress);

  console.log('FireflyReputation proxy deployed to:', reputationAddress);
  console.log('FireflyReputation implementation:', reputationImplAddress);
  console.log('');

  // =========================================================================
  // Crowdstacking Contracts (Phase 7)
  // =========================================================================

  // Initialize deployment info
  const deploymentInfo: DeploymentInfo = {
    network: networkName,
    chainId: Number(chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      BountyEscrow: {
        proxy: escrowAddress,
        implementation: escrowImplAddress,
      },
      FireflyReputation: {
        proxy: reputationAddress,
        implementation: reputationImplAddress,
      },
    },
  };

  // Deploy MockERC20 (pUSD) on testnet
  let pUSDAddress: string;

  if (isTestnet) {
    console.log('Deploying MockERC20 (pUSD) for testnet...');
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const pUSD = await MockERC20.deploy('pUSD Stablecoin', 'pUSD', 6);
    await pUSD.waitForDeployment();
    pUSDAddress = await pUSD.getAddress();

    console.log('MockERC20 (pUSD) deployed to:', pUSDAddress);
    console.log('');

    deploymentInfo.contracts.MockERC20 = { address: pUSDAddress };
  } else {
    // On mainnet, use the actual pUSD address
    // TODO: Replace with actual pUSD address when available
    pUSDAddress = '0x0000000000000000000000000000000000000000';
    console.log('Using mainnet pUSD address:', pUSDAddress);
    console.log('');
  }

  // Deploy CrowdstackingPool
  console.log('Deploying CrowdstackingPool...');
  const CrowdstackingPool = await ethers.getContractFactory('CrowdstackingPool');
  const pool = await upgrades.deployProxy(
    CrowdstackingPool,
    [deployer.address, pUSDAddress, deployer.address], // owner, paymentToken, yieldSource
    { initializer: 'initialize' }
  );
  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();
  const poolImplAddress = await upgrades.erc1967.getImplementationAddress(poolAddress);

  console.log('CrowdstackingPool proxy deployed to:', poolAddress);
  console.log('CrowdstackingPool implementation:', poolImplAddress);
  console.log('');

  deploymentInfo.contracts.CrowdstackingPool = {
    proxy: poolAddress,
    implementation: poolImplAddress,
  };

  // Deploy OutletRegistry
  console.log('Deploying OutletRegistry...');
  const OutletRegistry = await ethers.getContractFactory('OutletRegistry');
  const outletRegistry = await upgrades.deployProxy(
    OutletRegistry,
    [deployer.address, pUSDAddress, deployer.address], // owner, paymentToken, governance
    { initializer: 'initialize' }
  );
  await outletRegistry.waitForDeployment();

  const outletRegistryAddress = await outletRegistry.getAddress();
  const outletRegistryImplAddress =
    await upgrades.erc1967.getImplementationAddress(outletRegistryAddress);

  console.log('OutletRegistry proxy deployed to:', outletRegistryAddress);
  console.log('OutletRegistry implementation:', outletRegistryImplAddress);
  console.log('');

  deploymentInfo.contracts.OutletRegistry = {
    proxy: outletRegistryAddress,
    implementation: outletRegistryImplAddress,
  };

  // Deploy ContributorRegistry
  console.log('Deploying ContributorRegistry...');
  const ContributorRegistry = await ethers.getContractFactory('ContributorRegistry');
  const contributorRegistry = await upgrades.deployProxy(
    ContributorRegistry,
    [deployer.address, poolAddress], // owner, crowdstackingPool
    { initializer: 'initialize' }
  );
  await contributorRegistry.waitForDeployment();

  const contributorRegistryAddress = await contributorRegistry.getAddress();
  const contributorRegistryImplAddress = await upgrades.erc1967.getImplementationAddress(
    contributorRegistryAddress
  );

  console.log('ContributorRegistry proxy deployed to:', contributorRegistryAddress);
  console.log('ContributorRegistry implementation:', contributorRegistryImplAddress);
  console.log('');

  deploymentInfo.contracts.ContributorRegistry = {
    proxy: contributorRegistryAddress,
    implementation: contributorRegistryImplAddress,
  };

  // Deploy AllianceGovernance
  console.log('Deploying AllianceGovernance...');
  const AllianceGovernance = await ethers.getContractFactory('AllianceGovernance');
  const allianceGovernance = await upgrades.deployProxy(
    AllianceGovernance,
    [deployer.address, contributorRegistryAddress, outletRegistryAddress], // owner, contributorRegistry, outletRegistry
    { initializer: 'initialize' }
  );
  await allianceGovernance.waitForDeployment();

  const allianceGovernanceAddress = await allianceGovernance.getAddress();
  const allianceGovernanceImplAddress =
    await upgrades.erc1967.getImplementationAddress(allianceGovernanceAddress);

  console.log('AllianceGovernance proxy deployed to:', allianceGovernanceAddress);
  console.log('AllianceGovernance implementation:', allianceGovernanceImplAddress);
  console.log('');

  deploymentInfo.contracts.AllianceGovernance = {
    proxy: allianceGovernanceAddress,
    implementation: allianceGovernanceImplAddress,
  };

  // =========================================================================
  // Post-Deployment Configuration
  // =========================================================================

  console.log('Configuring contracts...');

  // Set OutletRegistry on CrowdstackingPool
  await pool.setOutletRegistry(outletRegistryAddress);
  console.log('  - Set OutletRegistry on CrowdstackingPool');

  // Authorize CrowdstackingPool as distributor on OutletRegistry
  await outletRegistry.setDistributor(poolAddress, true);
  console.log('  - Authorized CrowdstackingPool as distributor on OutletRegistry');

  console.log('');

  // =========================================================================
  // Save Deployment Info
  // =========================================================================

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('Deployment info saved to:', deploymentPath);

  console.log('');
  console.log('='.repeat(60));
  console.log('Deployment complete!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Contract Addresses:');
  console.log('  BountyEscrow:        ', escrowAddress);
  console.log('  FireflyReputation:   ', reputationAddress);
  if (isTestnet) {
    console.log('  MockERC20 (pUSD):    ', pUSDAddress);
  }
  console.log('  CrowdstackingPool:   ', poolAddress);
  console.log('  OutletRegistry:      ', outletRegistryAddress);
  console.log('  ContributorRegistry: ', contributorRegistryAddress);
  console.log('  AllianceGovernance:  ', allianceGovernanceAddress);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify contracts on block explorer');
  console.log('  2. Add updaters to FireflyReputation contract');
  console.log('  3. Add outlets to OutletRegistry');
  console.log('  4. Configure governance contract (replace deployer as governance)');
  console.log('  5. Update frontend config with contract addresses');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
