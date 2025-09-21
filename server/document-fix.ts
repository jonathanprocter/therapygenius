import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { extractTextFromFile, getFileMimeType } from "./document-processor";
import { analyzeDocument } from "./documentTagger";

export const repairDocumentSystem = async (): Promise<{
  repairedDocuments: number;
  errors: string[];
}> => {
  const errors: string[] = [];
  let repairedDocuments = 0;

  try {
    // Get all unprocessed documents
    const allDocs = await storage.getDocumentsByTherapist("", 1000); // Get all documents
    const unprocessedDocs = allDocs.filter(doc => !doc.isProcessed);

    console.log(`Found ${unprocessedDocs.length} unprocessed documents`);

    for (const doc of unprocessedDocs) {
      try {
        // Check if file exists
        const fileExists = await fs.access(doc.filePath).then(() => true).catch(() => false);
        
        if (!fileExists) {
          errors.push(`File not found: ${doc.filePath} for document ${doc.id}`);
          continue;
        }

        // Extract text content
        const mimeType = getFileMimeType(doc.fileName);
        const processed = await extractTextFromFile(doc.filePath, mimeType);

        // Analyze document
        const analysis = await analyzeDocument({
          ...doc,
          content: processed.content,
        }, doc.therapistId);

        // Update document with extracted content and analysis
        await storage.updateDocument(doc.id, {
          content: processed.content,
          metadata: {
            ...processed.metadata,
            analysis,
          },
          isProcessed: true,
          processingError: null,
        }, doc.therapistId);

        repairedDocuments++;
        console.log(`Repaired document: ${doc.fileName}`);
      } catch (error) {
        const errorMsg = `Failed to repair document ${doc.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(errorMsg);

        // Mark document with error
        await storage.updateDocument(doc.id, {
          processingError: error.message,
        }, doc.therapistId);
      }
    }
  } catch (error) {
    errors.push(`System repair failed: ${error.message}`);
  }

  return { repairedDocuments, errors };
};

export const verifyDocumentIntegrity = async (): Promise<{
  totalDocuments: number;
  validDocuments: number;
  missingFiles: number;
  corruptDocuments: number;
  issues: string[];
}> => {
  const issues: string[] = [];
  let validDocuments = 0;
  let missingFiles = 0;
  let corruptDocuments = 0;

  try {
    const allDocs = await storage.getDocumentsByTherapist("", 10000); // Get all documents
    
    for (const doc of allDocs) {
      try {
        // Check if file exists
        const fileExists = await fs.access(doc.filePath).then(() => true).catch(() => false);
        
        if (!fileExists) {
          missingFiles++;
          issues.push(`Missing file: ${doc.filePath} for document ${doc.fileName}`);
          continue;
        }

        // Check if file is readable
        const stats = await fs.stat(doc.filePath);
        if (stats.size === 0) {
          corruptDocuments++;
          issues.push(`Empty file: ${doc.filePath}`);
          continue;
        }

        // Check if file size matches database record
        if (stats.size !== doc.fileSize) {
          issues.push(`Size mismatch for ${doc.fileName}: DB=${doc.fileSize}, File=${stats.size}`);
        }

        validDocuments++;
      } catch (error) {
        corruptDocuments++;
        issues.push(`Corrupt document ${doc.fileName}: ${error.message}`);
      }
    }

    return {
      totalDocuments: allDocs.length,
      validDocuments,
      missingFiles,
      corruptDocuments,
      issues,
    };
  } catch (error) {
    issues.push(`Integrity check failed: ${error.message}`);
    return {
      totalDocuments: 0,
      validDocuments: 0,
      missingFiles: 0,
      corruptDocuments: 0,
      issues,
    };
  }
};

export const cleanupOrphanedFiles = async (): Promise<{
  filesDeleted: number;
  errors: string[];
}> => {
  const errors: string[] = [];
  let filesDeleted = 0;

  try {
    const uploadDir = path.join(process.cwd(), "uploads");
    
    // Get all files in upload directory recursively
    const getAllFiles = async (dir: string): Promise<string[]> => {
      const files: string[] = [];
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...await getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
      
      return files;
    };

    const allFiles = await getAllFiles(uploadDir);
    const allDocs = await storage.getDocumentsByTherapist("", 10000);
    const documentPaths = new Set(allDocs.map(doc => doc.filePath));

    for (const filePath of allFiles) {
      if (!documentPaths.has(filePath)) {
        try {
          await fs.unlink(filePath);
          filesDeleted++;
          console.log(`Deleted orphaned file: ${filePath}`);
        } catch (error) {
          errors.push(`Failed to delete ${filePath}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Cleanup failed: ${error.message}`);
  }

  return { filesDeleted, errors };
};
