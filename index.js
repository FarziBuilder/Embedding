// const qrcode = require('qrcode-terminal');
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
import qrcode from 'qrcode-terminal';
//import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;


import { Pinecone } from "@pinecone-database/pinecone";
import { Configuration, OpenAIApi } from "openai";
//import OpenAI from "openai";
import axios from 'axios';

// const openai = new OpenAIAPI({
//     apiKey: "sk-5nwCqLM",
//   });

import { config } from 'dotenv';
config();
console.log(process.env);

const url = 'https://api.openai.com/v1/embeddings';
const completions = 'https://api.openai.com/v1/chat/completions';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.API_KEY}` // Replace with your actual OpenAI API key
};

const pine_config = {
  environment: "us-west4-gcp-free",
  apiKey: process.env.NODE_KEY,
};

const pinecone = new Pinecone(pine_config);
const index = pinecone.Index("hadid");

async function getEmbedding(queryText) {
    const embed_model = "text-embedding-ada-002"
    const data = {
        model: embed_model,
        input: queryText
      };
    
    const response = await axios.post(url, data, { headers: headers });
    const xq = response['data']['data'][0]['embedding']
    return xq  
    //return new Array(1536).fill(0.1);
}

async function queryPinecone(queryText) {
  const queryEmbedding = await getEmbedding(queryText);
  try {
    const result = await index.query({ vector: queryEmbedding, topK: 3, includeMetadata: true});
    console.log("Pinecone Response:", result['matches'][0]['metadata']['text']);
    const contexts = [];
    
    result['matches'].forEach(match => {
        contexts.push(match['metadata']['text'])
    })
    const context = contexts.join(" ");
    return contexts
  } catch (error) {
    console.error(error);
  }
}

async function GPTmessage(context, text) {
    const data = {
        model: "gpt-4",
        messages: [
          {
            "role": "system",
            "content": `Give a straight 2-line answer. You have been given the context of Islamic Book of hadis. User will ask you questions. Based on the given context, give a straight intelligent 2 sentence answer after understanding the context ${context}.`
          },
          {
            "role": "user",
            "content": text
          }
        ]
      };      
    
    const response = await axios.post(completions, data, { headers: headers });
    //console.log(response['data']['choices'][0]['message']['content']);
    return response

}


const client = new Client({
    authStrategy: new LocalAuth()
});
client.on('qr', qr => {
qrcode.generate(qr, {small: true});
});
client.on('ready', () => {
console.log('Client is ready!');
});
client.initialize();
client.on('message', async message => {
  if (message.body.charAt(0) === '!') {
    const contact = await message.getContact();
    let myName = contact.pushname ? contact.pushname.replace(/ .*/, "") : contact.name;
    const phone = contact.number;
    const contactName = contact.shortName;
    const chat = await message.getChat();
    let text = message.body;

    const queryText = text;
    const contexts = await queryPinecone(queryText);
    const context = contexts.join(" ");
    const finalData = await GPTmessage(context, queryText);
    const finalRemark = `${finalData['data']['choices'][0]['message']['content']}.\n\n *These lines mention in Holy Book of Hadis mention about this topic* \n\n\n - ${contexts[0]}`;

    client.sendMessage(message.from, finalRemark);
}

})
