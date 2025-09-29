import { storage } from "./server/storage";
import { analyzeDocument } from "./server/documentTagger";

const THERAPIST_ID = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";

const DOCUMENT_IDS = [
  "a6714d75-1f14-493f-b8aa-acf8e2b4893e", // test-session-note-brianna-v2.txt
  "3e8ef7ef-fb7d-4b87-a69c-8cf640e3ff24", // test-session-note-brianna.txt
  "56c5f74d-6e15-4068-8d43-94c19a8f9e84", // test-assessment.txt
  "65d98f90-a94d-4298-bfe7-14aabd727d7d"  // test-session-note.txt
];

async function processDocuments() {
  console.log("🚀 Starting document analysis workflow...");
  console.log(`📄 Processing ${DOCUMENT_IDS.length} documents`);
  
  const results = [];
  
  for (const documentId of DOCUMENT_IDS) {
    try {
      console.log(`\n📋 Processing document: ${documentId}`);
      
      // Get the document from storage
      const document = await storage.getDocumentById(documentId, THERAPIST_ID);
      if (!document) {
        console.error(`❌ Document ${documentId} not found`);
        results.push({ documentId, status: 'not_found' });
        continue;
      }
      
      console.log(`✅ Found document: ${document.fileName}`);
      
      // Check if it already has analysis
      if (document.analysis) {
        console.log(`⚠️  Document ${document.fileName} already has analysis, skipping`);
        results.push({ documentId, status: 'already_analyzed' });
        continue;
      }
      
      if (!document.content) {
        console.error(`❌ Document ${document.fileName} has no content to analyze`);
        results.push({ documentId, status: 'no_content' });
        continue;
      }
      
      console.log(`🤖 Running AI analysis for ${document.fileName}...`);
      
      // Run AI analysis
      const analysisResults = await analyzeDocument(document, THERAPIST_ID);
      
      console.log(`📊 Analysis complete for ${document.fileName}:`);
      console.log(`   Category: ${analysisResults.category}`);
      console.log(`   Tags: ${analysisResults.tags.join(', ')}`);
      console.log(`   Key Insights: ${analysisResults.keyInsights.length} insights`);
      
      // Update document with analysis results
      await storage.updateDocumentAnalysis(
        document.id,
        analysisResults,
        {
          category: analysisResults.category,
          tags: analysisResults.tags,
          keyInsights: analysisResults.keyInsights
        },
        THERAPIST_ID
      );
      
      console.log(`✅ Document ${document.fileName} analysis saved successfully`);
      
      results.push({
        documentId,
        fileName: document.fileName,
        status: 'success',
        category: analysisResults.category,
        tagCount: analysisResults.tags.length,
        insightCount: analysisResults.keyInsights.length
      });
      
    } catch (error) {
      console.error(`❌ Error processing document ${documentId}:`, error);
      results.push({
        documentId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Summary
  console.log("\n📊 PROCESSING SUMMARY:");
  console.log("=" * 50);
  
  const successful = results.filter(r => r.status === 'success');
  const errors = results.filter(r => r.status === 'error');
  const notFound = results.filter(r => r.status === 'not_found');
  const alreadyAnalyzed = results.filter(r => r.status === 'already_analyzed');
  
  console.log(`✅ Successfully processed: ${successful.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  console.log(`🔍 Not found: ${notFound.length}`);
  console.log(`⚠️  Already analyzed: ${alreadyAnalyzed.length}`);
  
  if (successful.length > 0) {
    console.log("\n📄 SUCCESSFULLY PROCESSED DOCUMENTS:");
    successful.forEach(result => {
      console.log(`  • ${result.fileName} - ${result.category} (${result.tagCount} tags, ${result.insightCount} insights)`);
    });
  }
  
  if (errors.length > 0) {
    console.log("\n❌ ERRORS:");
    errors.forEach(result => {
      console.log(`  • ${result.documentId}: ${result.error}`);
    });
  }
  
  console.log("\n🏁 Document processing workflow completed!");
  
  return results;
}

// Execute the processing
processDocuments()
  .then(results => {
    console.log(`\n🎉 Process completed with ${results.length} results`);
    process.exit(0);
  })
  .catch(error => {
    console.error("💥 Fatal error in document processing:", error);
    process.exit(1);
  });