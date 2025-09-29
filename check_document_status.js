#!/usr/bin/env node

import { storage } from './server/storage.js';

async function checkDocumentStatus() {
  try {
    console.log('Checking document status for ID: 65d98f90-a94d-4298-bfe7-14aabd727d7d');
    
    const therapistId = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";
    const documentId = "65d98f90-a94d-4298-bfe7-14aabd727d7d";
    
    const document = await storage.getDocumentById(documentId, therapistId);
    
    if (!document) {
      console.log('❌ Document not found');
      return;
    }
    
    console.log('\n📄 Document Status:');
    console.log(`   File Name: ${document.fileName}`);
    console.log(`   Content Length: ${document.content?.length || 0} characters`);
    console.log(`   Is Processed: ${document.isProcessed}`);
    console.log(`   Category: ${document.category || 'Not set'}`);
    console.log(`   Tags: ${document.tags ? JSON.stringify(document.tags) : 'Not set'}`);
    console.log(`   Has Analysis: ${document.analysis ? '✅ Yes' : '❌ No'}`);
    console.log(`   Processing Error: ${document.processingError || 'None'}`);
    
    if (document.analysis) {
      console.log('\n🤖 AI Analysis Results:');
      console.log(`   Category: ${document.analysis.category}`);
      console.log(`   Tags: ${JSON.stringify(document.analysis.tags)}`);
      console.log(`   Key Insights: ${JSON.stringify(document.analysis.keyInsights)}`);
      console.log(`   Session Context: ${JSON.stringify(document.analysis.sessionContext || {})}`);
    }
    
    // Check for related sessions
    if (document.sessionId) {
      const session = await storage.getSessionById(document.sessionId, therapistId);
      console.log(`\n🔗 Linked Session: ${session ? session.sessionDate : 'Session not found'}`);
    } else {
      console.log('\n🔗 No linked session');
    }
    
  } catch (error) {
    console.error('Error checking document status:', error);
  }
}

checkDocumentStatus();