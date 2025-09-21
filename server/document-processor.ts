import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { Request } from "express";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { aiRouter } from "./ai";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
export const ensureUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    const therapistDir = path.join(UPLOAD_DIR, (req as any).userId || "unknown");
    try {
      await fs.access(therapistDir);
    } catch {
      await fs.mkdir(therapistDir, { recursive: true });
    }
    cb(null, therapistDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(", ")}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export interface ProcessedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractionMethod: "pdf-parse" | "mammoth" | "ocr" | "text";
  };
}

export const extractTextFromFile = async (filePath: string, mimeType: string): Promise<ProcessedDocument> => {
  try {
    const buffer = await fs.readFile(filePath);
    
    if (mimeType === "application/pdf") {
      return await extractFromPDF(buffer);
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await extractFromDocx(buffer);
    } else if (mimeType === "application/msword") {
      return await extractFromDoc(buffer);
    } else if (mimeType === "text/plain") {
      return await extractFromText(buffer);
    } else if (mimeType.startsWith("image/")) {
      return await extractFromImage(buffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw new Error(`Failed to extract text: ${(error as any)?.message || error}`);
  }
};

const extractFromPDF = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const data = await pdfParse(buffer);
  return {
    content: data.text,
    metadata: {
      pageCount: data.numpages,
      wordCount: data.text.split(/\s+/).length,
      extractionMethod: "pdf-parse",
    },
  };
};

const extractFromDocx = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const result = await mammoth.extractRawText({ buffer });
  return {
    content: result.value,
    metadata: {
      wordCount: result.value.split(/\s+/).length,
      extractionMethod: "mammoth",
    },
  };
};

const extractFromDoc = async (buffer: Buffer): Promise<ProcessedDocument> => {
  // For older .doc files, we'll use mammoth as well
  // In a production environment, you might want to use a more specialized library
  const result = await mammoth.extractRawText({ buffer });
  return {
    content: result.value,
    metadata: {
      wordCount: result.value.split(/\s+/).length,
      extractionMethod: "mammoth",
    },
  };
};

const extractFromText = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const content = buffer.toString("utf-8");
  return {
    content,
    metadata: {
      wordCount: content.split(/\s+/).length,
      extractionMethod: "text",
    },
  };
};

const extractFromImage = async (buffer: Buffer): Promise<ProcessedDocument> => {
  try {
    const content = await aiRouter.ocrImage(buffer);
    
    return {
      content,
      metadata: {
        wordCount: content.split(/\s+/).length,
        extractionMethod: "ocr",
      },
    };
  } catch (error) {
    console.error("Error performing OCR:", error);
    throw new Error(`OCR failed: ${(error as any)?.message || error}`);
  }
};

export const getFileMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  
  return mimeTypes[ext] || "application/octet-stream";
};
