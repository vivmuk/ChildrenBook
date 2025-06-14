const axios = require('axios');

const VENICE_API_KEY = 'ntmhtbP2fr_pOQsmuLPuN_nm6lm2INWKiNcvrdEfEC';

exports.handler = async function (event, context) {
    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('Test function called successfully');
        
        // Simple test first
        if (event.queryStringParameters && event.queryStringParameters.simple === 'true') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    message: 'Netlify function is working!',
                    timestamp: new Date().toISOString(),
                    nodeVersion: process.version 
                }),
            };
        }

        // Test Venice.ai API connection
        console.log('Testing Venice.ai API connection...');
        const response = await axios.get('https://api.venice.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
            params: { type: 'text' },
            timeout: 10000 // 10 second timeout
        });

        console.log('Venice.ai API response received');
        const models = response.data.data.slice(0, 3); // Just get first 3 models

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Venice.ai API is working!',
                modelsCount: response.data.data.length,
                sampleModels: models.map(m => m.id)
            }),
        };

    } catch (error) {
        console.error('Test function error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Test function failed',
                details: error.message,
                stack: error.stack
            }),
        };
    }
}; 