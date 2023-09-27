import { ethers, run } from 'hardhat'

const deploy = async () => {
  const [owner] = await ethers.getSigners()
  console.log('Balance: ', (await owner.getBalance()).toString())
  const contract = await ethers.getContractFactory('Token')

  console.log('Deploying contract ...')
  const instance = await contract.deploy(
    `${process.env.TOKEN_NAME}`,
    `${process.env.TOKEN_SYMBOL}`,
    process.env.OWNER ? `${process.env.OWNER}` : owner.address
  )
  await instance.deployed()
  console.log('Deployed contract: ', instance.address)

  await run('verify:verify', {
    address: instance.address,
    constructorArguments: [
      `${process.env.TOKEN_NAME}`,
      `${process.env.TOKEN_SYMBOL}`,
      process.env.OWNER ? `${process.env.OWNER}` : owner.address,
    ],
  })
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log('Error: ', error)
    process.exit(1)
  })
