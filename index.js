const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const multer = require('multer');
const axios = require('axios');

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
async function callCustomAPI(messages) {
  try {
    const response = await axios.post('http://localhost:123g4/v1/chat/completions', {
      model: 'LM Studio Community/Meta-Llama-3-8B-Instruct-GGUF',
      messages: [
        { role: 'system', content: 'Always answer in rhymes.' },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: -1,
      stream: false
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling custom API:', error);
    throw error;
  }
}

// Update the agentRouter function to include text classification logic
function agentRouter(input) {
  if (input.image) {
    return 'imageAgent';
  } else if (input.message) {
    // Simple text classification logic to distinguish FAQ from issue description
    const faqKeywords = ['how', 'what', 'why', 'when', 'where'];
    const issueKeywords = ['error', 'issue', 'problem', 'bug', 'fail'];

    const message = input.message.toLowerCase();

    if (faqKeywords.some(keyword => message.includes(keyword))) {
      return 'faqAgent';
    } else if (issueKeywords.some(keyword => message.includes(keyword))) {
      return 'issueAgent';
    } else {
      return 'clarificationAgent';
    }
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
  return await callCustomAPI([{ role: 'user', content: message }]);
}

async function handleIssueAgent(message) {
  // Use the AI API for issue-related responses
  return await callCustomAPI([{ role: 'user', content: 'Resolve this issue: ' + message }]);
}

async function clarificationAgent(message) {
  // Use the AI API for clarification responses
  return await callCustomAPI([{ role: 'user', content: 'Clarify this input: ' + message }]);
}

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

// Update the /chat route to include the responding agent in the response
app.post('/chat', upload.single('image'), async (req, res) => {
  const { message } = req.body;
  const image = req.file;

  const agent = agentRouter({ message, image });
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