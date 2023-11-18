import { readFile, writeFile } from "fs"


function loadPackageJson() {
  return new Promise((resolve, reject) => {
    readFile("package.json", 'utf-8', (err, data) => {
      if (err) reject(err)
      resolve(JSON.parse(data))
    })
  })
}

function savePackageJson(config) {
  return new Promise((resolve, reject) => {
    writeFile("package.json", JSON.stringify(config), (err) => {
      if (err) reject("Failed to save file")
      resolve()
    })
  })
}

async function main(argv) {
  argv.splice(0, 2)
  if (argv.length <= 0) {
    throw Error("Missing reqired parameter! version=X.X.X")
  }
  const version = argv.find(arg => (arg.split("=")[0] === 'version'))
  if (!version) {
    throw Error("Missing required parameter! version=X.X.X")
  }

  try {
    const pack = await loadPackageJson()
    pack.version = version.split("=")[1]
    await savePackageJson(pack)
  } catch (e) {
    console.error("Failed to setup package version!", e)
  }

}

main(process.argv)