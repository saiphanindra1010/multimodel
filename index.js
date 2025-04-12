import express from 'express';
import exphbs from 'express-handlebars';
import bodyParser from 'body-parser';
import multer from 'multer';
import axios from 'axios';
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = 3000;

// Configure Handlebars
app.engine('handlebars', exphbs.engine());
app.set('view engine', 'handlebars');
app.set('views', './views');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const upload = multer({ dest: 'uploads/' });

// Update all agent functions to use the specified AI API
const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.inference.ai.azure.com";

async function ClarificationAgentDeepseekv3(messages) {
    const modelName = "DeepSeek-V3-0324";
  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );
  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role:"system", content: "You are a helpful clarification agent that askes valid questions. and make users talk about only about Real Estate" },
        { role:"user", content: messages[0].content }
      ],
      temperature: 1.0,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName
    }
  });
    
      if (isUnexpected(response)) {
        throw response.body.error;
      }
    
      console.log(response.body.choices[0].message.content);
      return response.body.choices[0].message.content;
}

async function faqAgent(messages) {
    const modelName = "Phi-3.5-MoE-instruct";

  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );
  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role:"system", content: "You are a agent who only replyes for faqs about real estate" },
        { role:"user", content: messages[0].content }
      ],
      temperature: 1.0,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName
    }
  });
    
      if (isUnexpected(response)) {
        throw response.body.error;
      }
    
      console.log(response.body.choices[0].message.content);
      return response.body.choices[0].message.content;
}

async function callCustomAPI(messages) {
  const modelName = "Llama-4-Maverick-17B-128E-Instruct-FP8";

  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );
  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role: "system", content: "you are agent with image capabilities and you will help issue with housing issues" },
        { role: "user", content: messages[0].content }
      ],
      temperature: 1.0,
      top_p: 1.0,
      max_tokens: 1000,
      model: modelName
    }
  });

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  console.log(response.body.choices[0].message.content);
  return response.body.choices[0].message.content;
}

// Update the agentRouter function to use AI for routing by calling the AI API to classify the input into one of the predefined agent types
async function agentRouter(input) {
    const modelName = "DeepSeek-R1";
    // console.log("this is token", token);
    console.log("this is endpoint", endpoint);
    console.log("this is modelName", modelName);
    console.log("this is input", input);
    
  if (input.image) {
    return 'imageAgent';
  } else if (input.message) {
    
  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role:"user", content: "What is the capital of France?" }
      ],
      max_tokens: 1000,
      model: modelName
    }
  });
  

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  console.log(response.body.choices[0].message.content);
    const classification = response.body.choices[0].message.content.trim();
    return classification;
  } else {
    return 'clarificationAgent';
  }
}

// Define all agent logic with their respective prompts
async function handleImageAgent(image, message) {
  // Use the AI API for image-related responses
  return await callCustomAPI([{ role: 'user', content: 'Analyze this image and message: ' + message }]);
}

async function handleFAQAgent(message) {
  // Use the AI API for FAQ responses
  return await faqAgent([{ role: 'user', content: message }]);
}

async function handleIssueAgent(message) {
  // Use the AI API for issue-related responses
  return await callCustomAPI([{ role: 'user', content: 'Resolve this issue: ' + message }]);
}

async function clarificationAgent(message) {
  // Use the AI API for clarification responses
  return await ClarificationAgentDeepseekv3([{ role: 'user', content: 'Clarify this input: ' + message }]);
}

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

// Update the /chat route to include the responding agent in the response
app.post('/chat', upload.single('image'), async (req, res) => {
  const { message } = req.body;
  const image = req.file;

  const agent = await agentRouter({ message, image });
  console.log("this is agent", agent);
  console.log("this is message", message);
  let response;

  if (agent === 'imageAgent') {
    response = await handleImageAgent(image, message);
  } else if (agent === 'faqAgent') {
    response = await handleFAQAgent(message);
  } else if (agent === 'issueAgent') {
    response = await handleIssueAgent(message);
  } else {
    response = await clarificationAgent(message);
  }

  res.json({ response, agent });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});