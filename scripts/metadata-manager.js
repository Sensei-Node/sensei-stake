const fs = require('fs');
const API_KEY = process.env.NFT_STORAGE_API_KEY
const { NFTStorage } = require('nft.storage')
const { Blob } = require('buffer')

module.exports.uploadFile = async (index) => {
    const client = new NFTStorage({ token: API_KEY });
    // ! get image which name == index
    const image = fs.readFileSync(`${__dirname}/../images/${index}.png`);
    // ! upload image to ipfs
    const ipfs_image = await client.storeBlob(new Blob([image]));
    // const status = await client.status(ipfs_image)
    // console.log(status)
    // console.log(image.toString("base64"))
    return ipfs_image;
}

module.exports.uploadDirectory = async (dir) => {
    const files = fs.readdirSync(dir);
    const client = new NFTStorage({ token: API_KEY });
    let cids = [];
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const file_name = file.split('.');
        const name = file_name[0];
        const extension = file_name[1];
        console.log('uploading', file);
        if (extension == 'png') {
            const image = fs.readFileSync(`${__dirname}/../images/${file}`);
            const cid = await client.storeBlob(new Blob([image]));
            cids.push(cid)
        }
    }
    console.log(cids)
    fs.writeFileSync(__dirname + `/../images/images.json`, JSON.stringify(cids));
}

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

module.exports.preparedMetadataFolder = async () => {
    let rawdata_pub_keys = fs.readFileSync(__dirname + `/../keystores/validator_public_keys.json`);
    let pub_keys = JSON.parse(rawdata_pub_keys);
    let rawdata_images = fs.readFileSync(__dirname + `/../images/images.json`);
    let images = JSON.parse(rawdata_images);
    if (pub_keys.length > images.length) {
        console.log(pub_keys, images);
        return;
    }
    for (let index = 1; index <= pub_keys.length; index++) {
        const pubKey = pub_keys[index-1];
        const image = images[index-1];
        await module.exports.metadataGenerator(index, image, pubKey);
    }
}

async function main() {
    await module.exports.preparedMetadataFolder();
}

main().then(
    text => { if (text) console.log(text) },
    err => { if (err) console.error(err) }
)