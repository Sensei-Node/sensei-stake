const fs = require('fs');
const API_KEY = process.env.NFT_STORAGE_API_KEY
const { NFTStorage } = require('nft.storage')
// import { NFTStorage } from 'nft.storage'

// module.exports.metadataUploader = async (index, validatorPubKey) => {
//     const client = new NFTStorage({ token: API_KEY })
//     // TODO: get image from fs (name == index)
//     // ! get image which name == index
//     const image = fs.readSync()
//     // ! upload image to ipfs
//     const ipfs_image = await client.store(image)
//     console.log('NFT data stored!')
//     console.log('Metadata: ', ipfs_image)
//     console.log('Metadata URI: ', ipfs_image.url)
//     // ! upload metadata to ipfs
//     const metadata = module.exports.metadataGenerator(index, image.cid, validatorPubKey)
//     const ipfs_metadata = await client.store(metadata)
// }

// module.exports.metadataUploader = async (index, validatorPubKey) => {
//     const metadata = {
//         "name": `Validator #${index}`,
//         "description": "Senseistake is a project blah blah by Senseinode.com",
//         "external_url": "app.senseistake.com",
//         "image": `ipfs://${image}`,
//         "attributes": [{
//             "trait_type": "Validator Address",
//             "value": validatorPubKey
//         }]
//     }
// }

module.exports.metadataGenerator = async (index, image, validatorPubKey) => {
    const metadata = {
        "name": `Validator #${index}`,
        "description": "Senseistake is a project blah blah by Senseinode.com",
        "external_url": "app.senseistake.com",
        "image": `ipfs://${image}`,
        "attributes": [{
            "trait_type": "Validator Address",
            "value": validatorPubKey
        }]
    }
    fs.writeFileSync(__dirname + `/../metadata/${index}`, JSON.stringify(metadata));
    return metadata;
}

// module.exports.imageUploader = async (index) => {
    
// }

module.exports.upload = async () => {
    let rawdata_pub_keys = fs.readFileSync(__dirname + `/../keystores/validator_public_keys.json`);
    let pub_keys = JSON.parse(rawdata_pub_keys);
    let rawdata_images = fs.readFileSync(__dirname + `/../images/images.json`);
    let iamges = JSON.parse(rawdata_images);
    for (let index = 1; index < pub_keys.length; index++) {
        const pubKey = pub_keys[index-1];
        const image = iamges[index-1];
        const metadata = module.exports.metadataGenerator(index, image, pubKey);
        console.log(metadata);
    }
}

// ! SE LLAMARIA AL UPLOAD AL FINAL DE TODO....