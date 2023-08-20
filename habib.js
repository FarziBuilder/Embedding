const { Client } = require('whatsapp-web.js');
const client = new Client();
const qrcode = require('qrcode'); // Import the qrcode library
const fs = require('fs'); // Import the fs module
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
    apiKey: "k-Y8sQrOUu3J0Po0tP6oY0T3BlbkFJYJIXMdHbobnBon4P7GkN",
});


import { PineconeClient } from '@pinecone-database/pinecone';
const pinecone = new PineconeClient();
await pinecone.init({
    api_key: '464971ca-33af-4b8a-88e6-1f076d57a10b',      
	environment: 'us-west1-gcp'
});

const index = pinecone.Index("hadid")

embed_model = "text-embedding-ada-002"

const axios = require('axios');

const url = 'https://api.openai.com/v1/embeddings';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer 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` // Replace with your actual OpenAI API key
};

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);

    try {
        // Generate QR code as a data URL
        const qrCodeDataUrl = await qrcode.toDataURL(qr);

        // Remove the data URL header to extract the base64 encoded data
        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');

        // Convert base64 data to a Buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Save the buffer as a PNG file
        const qrImagePath = 'qrcode.png'; // Specify the desired file name and format
        fs.writeFileSync(qrImagePath, buffer);

        console.log(`QR code saved as ${qrImagePath}`);
    } catch (error) {
        console.error('Error generating or saving QR code:', error);
    }
});

client.on('ready', async () => {
    console.log('Client is ready!');

    try {
        
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
    }
});

client.initialize();

client.on('message', async message => {
    //collecting data from Whatsapp
    const openai = new OpenAIApi(configuration);
    let text = message.body;
    //just do an embedding call to it
    const data = {
        model: embed_model,
        input: text
      };
      
    const response = await axios.post(url, data, { headers: headers });
    xq = response['data']['data'][0]['embedding']
    //search in embeddings
    const queryResponse = await index.query({
        query: {
          xq,
          topK: 3,
          includeMetadata: true    
        }
      })
    let contexts = queryResponse.matches.map(x => x.metadata.text);
    //then do a GPT call to it.
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            {"role": "system", "content": `Do not only quote the context, give an intelligent 2 sentence answer after understanding the context ${context}`},
            {"role": "user", "content": text}
          ],
        temperature: 0,
      });

    reply = completion.choices[0].message["content"] 
    const chat = await message.getChat();
    
    client.sendMessage(message.from, reply)
})
