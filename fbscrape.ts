import axios from 'axios';

import * as fs from 'fs';
// import YAML from 'yaml'

// // Read the config.yaml file
// const configFile = fs.readFileSync('config.yaml', 'utf8');

// // Parse the YAML into JSON
// const configJson = YAML.parse(configFile)

const configFile = "./src/_data/albums.json"
const configJson = require(configFile)


import cheerio, { AnyNode } from 'cheerio';
import { config } from 'process';

const api = axios.create({
  // baseURL: "https://www.facebook.com",
  headers: {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    "sec-fetch-site": "same-origin"
  },
});

async function downloadFile(url: string, filePath: string): Promise<void> {
  // Check if the file already exists
  if (fs.existsSync(filePath)) {
    console.log('File already exists. Skipping download.');
    return;
  }

  // Download the file
  const response = await axios.get(url, { responseType: 'stream' });
  const writer = fs.createWriteStream(filePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}


async function main() {

  configJson.album = await Promise.all(configJson.album.map(async (config: { title: string; description: string; albumid: string; }) => {

    const images = await fetchAlbum(config.albumid)
    const scraped = albumScraper(images)
    return {
      ...config,
      images: scraped
    }
  }).map(async (album: { images: { uri: string; id: any; }[]; }) => {

    (await album).images.map(async (image: { uri: string; id: any; }) => {
      await downloadFile(image.uri, `./src/assets/images/scraped/${image.id}.jpg`)
    })
    return album
  }))
  fs.writeFileSync(configFile, JSON.stringify(configJson, null, "  "))
}
main()


async function fetchAlbum(id: string): Promise<any> {
  try {
    const response = await api.get(`https://www.facebook.com/media/set/?set=${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching album:', error);
    throw error;
  }
}



function albumScraper(response: string | AnyNode | AnyNode[] | Buffer) {
  const $ = cheerio.load(response)
  // Loop through all script tags
  for (const scriptTag of $('script').toArray()) {
    const scriptContent = $(scriptTag).html();
    // console.log(scriptContent);
    if (scriptContent && scriptContent.includes('CLDRDateRenderingClientRollout')) {
      // Return the script content if the specified string is found
      try {
        return JSON.parse(scriptContent).require[0][3][0].__bbox.require[7][3][1].__bbox.result.data.album.media.edges
          .map((photo: { node: any; }) => {
            return {
              id: photo.node.id,
              uri: photo.node.image.uri,
              height: photo.node.image.height,
              width: photo.node.image.width
            }
          })
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }

    }
  }
  return null;
}
