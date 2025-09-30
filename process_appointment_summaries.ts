import path from "path";
import fs from "fs/promises";
import { storage } from "./server/storage";
import { extractTextFromFile, getFileMimeType, processDocumentWithAutoLinking, DocumentUploadContext } from "./server/document-processor";
import { InsertDocument } from "./shared/schema";
import "dotenv/config";

const THERAPIST_ID = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";
const ATTACHED_ASSETS_DIR = path.join(process.cwd(), "attached_assets");

interface ProcessingResult {
  fileName: string;
  status: "success" | "partial" | "failed";
  documentId?: string;
  clientId?: string;
  clientName?: string;
  sessionMatch?: {
    sessionId: string;
    confidence: number;
  };
  errors?: string[];
  aiAnalysis?: {
    category: string;
    tags: string[];
    keyInsights: string[];
  };
}

/**
 * Extract client name from filename
 * Examples:
 *   "Brian_Kolsch_Appointment_Summary_1759183997401.docx" -> "Brian Kolsch"
 *   "Richie_Hayes_Appointment_Summary_1759163759667.docx" -> "Richie Hayes"
 *   "Chris_Balabanick_Summary_1759183997401.docx" -> "Chris Balabanick"
 */
function extractClientNameFromFilename(filename: string): { firstName: string; lastName: string } | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.docx$/i, '');
  
  // Remove timestamp suffix (pattern: _1759183997401)
  const nameWithoutTimestamp = nameWithoutExt.replace(/_\d{13}$/, '');
  
  // Remove common suffixes
  const nameWithoutSuffix = nameWithoutTimestamp
    .replace(/_Appointment_Summary$/i, '')
    .replace(/_Summary$/i, '')
    .replace(/_Appointment$/i, '')
    .replace(/_SII_-_Summary$/i, '');
  
  // Split by underscore to get name parts
  const parts = nameWithoutSuffix.split('_').filter(p => p.length > 0);
  
  if (parts.length >= 2) {
    // For names like "Brian_Kolsch" or "Chris_Balabanick"
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' '); // Handle multi-part last names
    return { firstName, lastName };
  } else if (parts.length === 1) {
    // For single names like "Kieran", try to match by first name only
    return { firstName: parts[0], lastName: '' };
  }
  
  return null;
}

/**
 * Find matching client in database
 * Handles name variations (e.g., "Richie" -> "Richard")
 */
async function findMatchingClient(extractedName: { firstName: string; lastName: string }): Promise<any | null> {
  const allClients = await storage.getClientsByTherapist(THERAPIST_ID);
  
  // First try exact match
  let match = allClients.find(c => 
    c.firstName.toLowerCase() === extractedName.firstName.toLowerCase() &&
    c.lastName.toLowerCase() === extractedName.lastName.toLowerCase()
  );
  
  if (match) return match;
  
  // Try nickname variations
  const nicknameMap: Record<string, string[]> = {
    'Richard': ['Richie', 'Rich', 'Rick', 'Dick'],
    'Christopher': ['Chris'],
    'Matthew': ['Matt'],
    'Michael': ['Mike'],
    'James': ['Jim', 'Jimmy'],
    'Jerry': ['Gerald', 'Jeremiah'],
    'Luke': ['Lucas'],
    'CJ': ['C.J.', 'Charles', 'Carl'],
    'Caitlin': ['Kate', 'Katie', 'Cait'],
    'Frederick': ['Freddy', 'Fred'],
    'Kieran': ['Kieran', 'Kieren'],
    'Brian': ['Bryan'],
    'Brianna': ['Bri'],
    'Valentina': ['Val'],
    'Vivian': ['Viv'],
    'Sarah': ['Sara']
  };
  
  // Try to find by nickname or full name
  for (const [fullName, nicknames] of Object.entries(nicknameMap)) {
    if (nicknames.some(n => n.toLowerCase() === extractedName.firstName.toLowerCase())) {
      match = allClients.find(c => 
        c.firstName.toLowerCase() === fullName.toLowerCase() &&
        c.lastName.toLowerCase() === extractedName.lastName.toLowerCase()
      );
      if (match) return match;
    }
  }
  
  // Try partial last name match (for single letter last names like "Caitlin_D")
  if (extractedName.lastName.length === 1) {
    match = allClients.find(c => 
      c.firstName.toLowerCase() === extractedName.firstName.toLowerCase() &&
      c.lastName.toLowerCase().startsWith(extractedName.lastName.toLowerCase())
    );
    if (match) return match;
  }
  
  // Try first name only match (if last name is empty)
  if (!extractedName.lastName) {
    match = allClients.find(c => 
      c.firstName.toLowerCase() === extractedName.firstName.toLowerCase()
    );
    if (match) return match;
  }
  
  return null;
}

/**
 * Process a single document file
 */
async function processDocument(filePath: string, fileName: string): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    fileName,
    status: "success",
    errors: []
  };
  
  try {
    console.log(`\n========== Processing: ${fileName} ==========`);
    
    // Step 1: Extract text from file
    console.log('Step 1: Extracting text from document...');
    const mimeType = getFileMimeType(fileName);
    const extractedDoc = await extractTextFromFile(filePath, mimeType);
    console.log(`✓ Extracted ${extractedDoc.metadata.wordCount} words using ${extractedDoc.metadata.extractionMethod}`);
    
    // Step 2: Parse client name from filename
    console.log('Step 2: Parsing client name from filename...');
    const extractedName = extractClientNameFromFilename(fileName);
    if (!extractedName) {
      throw new Error(`Could not extract client name from filename: ${fileName}`);
    }
    console.log(`✓ Parsed name: ${extractedName.firstName} ${extractedName.lastName}`);
    
    // Step 3: Find matching client in database
    console.log('Step 3: Finding matching client in database...');
    const matchedClient = await findMatchingClient(extractedName);
    if (!matchedClient) {
      result.errors?.push(`No client found matching name: ${extractedName.firstName} ${extractedName.lastName}`);
      console.log(`⚠ No matching client found`);
    } else {
      result.clientId = matchedClient.id;
      result.clientName = `${matchedClient.firstName} ${matchedClient.lastName}`;
      console.log(`✓ Matched to client: ${result.clientName} (${result.clientId})`);
    }
    
    // Step 4: Create document record in database
    console.log('Step 4: Creating document record in database...');
    
    // Get file size
    const fileStats = await fs.stat(filePath);
    const fileSize = fileStats.size;
    
    // Truncate MIME type to fit database constraint (50 chars)
    const truncatedMimeType = mimeType.substring(0, 50);
    
    const documentData: InsertDocument = {
      therapistId: THERAPIST_ID,
      clientId: matchedClient?.id || null,
      fileName: fileName,
      filePath: filePath,
      fileType: truncatedMimeType,
      fileSize: fileSize,
      content: extractedDoc.content,
      uploadDate: new Date(),
      isProcessed: false, // Will be set to true after AI analysis
      category: null,
      tags: [],
      analysis: null
    };
    
    const createdDocument = await storage.createDocument(documentData);
    result.documentId = createdDocument.id;
    console.log(`✓ Created document record: ${createdDocument.id}`);
    
    // Step 5: Run AI analysis and auto-linking
    console.log('Step 5: Running AI analysis and auto-linking...');
    const context: DocumentUploadContext = {
      therapistId: THERAPIST_ID,
      clientId: matchedClient?.id,
      manualClientOverride: false
    };
    
    const autoLinkingResult = await processDocumentWithAutoLinking(createdDocument, context);
    
    // Update result with analysis data
    if (autoLinkingResult.analysisResults) {
      result.aiAnalysis = {
        category: autoLinkingResult.analysisResults.category,
        tags: autoLinkingResult.analysisResults.tags,
        keyInsights: autoLinkingResult.analysisResults.keyInsights
      };
      console.log(`✓ AI Analysis completed:`);
      console.log(`  - Category: ${autoLinkingResult.analysisResults.category}`);
      console.log(`  - Tags: ${autoLinkingResult.analysisResults.tags.join(', ')}`);
      console.log(`  - Key Insights: ${autoLinkingResult.analysisResults.keyInsights.length} insights`);
    }
    
    if (autoLinkingResult.sessionMatch) {
      result.sessionMatch = {
        sessionId: autoLinkingResult.sessionMatch.sessionId,
        confidence: autoLinkingResult.sessionMatch.confidence
      };
      console.log(`✓ Auto-linked to session: ${autoLinkingResult.sessionMatch.sessionId} (confidence: ${autoLinkingResult.sessionMatch.confidence})`);
    } else if (autoLinkingResult.potentialMatches && autoLinkingResult.potentialMatches.length > 0) {
      console.log(`⚠ Found ${autoLinkingResult.potentialMatches.length} potential session matches but none met confidence threshold`);
    }
    
    // Mark document as processed
    await storage.updateDocument(createdDocument.id, { isProcessed: true }, THERAPIST_ID);
    console.log(`✓ Marked document as processed`);
    
    result.status = autoLinkingResult.processingStatus;
    if (autoLinkingResult.errors && autoLinkingResult.errors.length > 0) {
      result.errors?.push(...autoLinkingResult.errors);
    }
    
    console.log(`✅ Processing completed with status: ${result.status}`);
    
  } catch (error) {
    console.error(`❌ Error processing document:`, error);
    result.status = "failed";
    result.errors?.push(`Processing error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return result;
}

/**
 * Main function to process all appointment summary documents
 */
async function processAllAppointmentSummaries() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     APPOINTMENT SUMMARY DOCUMENT PROCESSING PIPELINE          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Therapist ID: ${THERAPIST_ID}`);
  console.log(`HIPAA_SAFE_AI: ${process.env.HIPAA_SAFE_AI || 'false'}`);
  console.log(`Source Directory: ${ATTACHED_ASSETS_DIR}\n`);
  
  try {
    // Step 1: Find all summary documents
    console.log('Finding all appointment summary documents...');
    const allFiles = await fs.readdir(ATTACHED_ASSETS_DIR);
    const summaryFiles = allFiles.filter(f => 
      f.endsWith('.docx') && 
      (f.includes('Summary') || f.includes('Appointment'))
    );
    
    console.log(`Found ${summaryFiles.length} document files:\n`);
    summaryFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('');
    
    // Step 2: Process each document
    const results: ProcessingResult[] = [];
    
    for (let i = 0; i < summaryFiles.length; i++) {
      const fileName = summaryFiles[i];
      const filePath = path.join(ATTACHED_ASSETS_DIR, fileName);
      
      console.log(`\n[${i + 1}/${summaryFiles.length}] Processing: ${fileName}`);
      
      const result = await processDocument(filePath, fileName);
      results.push(result);
      
      // Add a small delay to avoid overwhelming the AI API
      if (i < summaryFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Step 3: Generate summary report
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    PROCESSING SUMMARY REPORT                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    const successCount = results.filter(r => r.status === "success").length;
    const partialCount = results.filter(r => r.status === "partial").length;
    const failedCount = results.filter(r => r.status === "failed").length;
    const linkedToClientCount = results.filter(r => r.clientId).length;
    const linkedToSessionCount = results.filter(r => r.sessionMatch).length;
    const withAIAnalysisCount = results.filter(r => r.aiAnalysis).length;
    
    console.log(`📊 OVERALL STATISTICS:`);
    console.log(`   Total Documents: ${results.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⚠️  Partial: ${partialCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   🔗 Linked to Client: ${linkedToClientCount}`);
    console.log(`   📅 Linked to Session: ${linkedToSessionCount}`);
    console.log(`   🤖 AI Analysis Completed: ${withAIAnalysisCount}`);
    console.log('');
    
    // Successful documents
    console.log(`\n✅ SUCCESSFULLY PROCESSED (${successCount}):`);
    results.filter(r => r.status === "success").forEach(r => {
      console.log(`   ✓ ${r.fileName}`);
      console.log(`      - Document ID: ${r.documentId}`);
      console.log(`      - Client: ${r.clientName || 'Not linked'}`);
      if (r.aiAnalysis) {
        console.log(`      - Category: ${r.aiAnalysis.category}`);
        console.log(`      - Tags: ${r.aiAnalysis.tags.slice(0, 3).join(', ')}${r.aiAnalysis.tags.length > 3 ? '...' : ''}`);
      }
      if (r.sessionMatch) {
        console.log(`      - Session: ${r.sessionMatch.sessionId} (${Math.round(r.sessionMatch.confidence * 100)}% confidence)`);
      }
      console.log('');
    });
    
    // Partially processed documents
    if (partialCount > 0) {
      console.log(`\n⚠️  PARTIALLY PROCESSED (${partialCount}):`);
      results.filter(r => r.status === "partial").forEach(r => {
        console.log(`   ⚠ ${r.fileName}`);
        console.log(`      - Document ID: ${r.documentId}`);
        console.log(`      - Client: ${r.clientName || 'Not linked'}`);
        if (r.errors && r.errors.length > 0) {
          console.log(`      - Issues: ${r.errors.join('; ')}`);
        }
        console.log('');
      });
    }
    
    // Failed documents
    if (failedCount > 0) {
      console.log(`\n❌ FAILED TO PROCESS (${failedCount}):`);
      results.filter(r => r.status === "failed").forEach(r => {
        console.log(`   ✗ ${r.fileName}`);
        if (r.errors && r.errors.length > 0) {
          console.log(`      - Errors: ${r.errors.join('; ')}`);
        }
        console.log('');
      });
    }
    
    // Documents without client match
    const unmatchedClients = results.filter(r => !r.clientId);
    if (unmatchedClients.length > 0) {
      console.log(`\n🔍 DOCUMENTS WITHOUT CLIENT MATCH (${unmatchedClients.length}):`);
      unmatchedClients.forEach(r => {
        console.log(`   - ${r.fileName}`);
      });
      console.log('');
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    PROCESSING COMPLETE                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Exit with appropriate code
    if (failedCount > 0) {
      process.exit(1);
    } else if (partialCount > 0) {
      process.exit(0); // Partial is still acceptable
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error);
    process.exit(1);
  }
}

// Run the processing pipeline
processAllAppointmentSummaries();
