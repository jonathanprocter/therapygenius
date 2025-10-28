# Transcript Processing System

## Overview

The TherapyGenius application includes a sophisticated AI-powered system for converting raw therapy session transcripts into comprehensive clinical progress notes that meet professional mental health documentation standards.

## How It Works

### 1. Document Upload & Detection

When you upload a document:

```javascript
// Upload transcript
POST /api/documents/upload
{
  files: [transcript.pdf],
  clientId: "client-123",
  sessionId: "session-456" // Optional
}
```

**AI automatically detects format:**
- **Transcript Format**: Contains speaker labels like "Therapist:", "Client:", conversational Q&A
  - `documentFormat.type = "transcript"`
  - `documentFormat.needsProcessing = TRUE`
  - `documentFormat.processingNotes = "Raw transcript requiring conversion to clinical note"`

- **Progress Note Format**: Already formatted with SOAP/DAP/BIRP structure
  - `documentFormat.type = "progress_note"`
  - `documentFormat.needsProcessing = FALSE`
  - `documentFormat.processingNotes = "Already in clinical format - ready to use"`

### 2. Transcript Processing

**Convert transcript to clinical progress note:**

```javascript
// Process single transcript
POST /api/documents/{documentId}/process-transcript

// Response
{
  "message": "Transcript processed successfully",
  "processedDocumentId": "doc-789"
}
```

**What happens:**
1. Retrieves original transcript document
2. Extracts client name and session date
3. Uses comprehensive clinical prompt (ACT/DBT/Narrative/Existential frameworks)
4. Generates professional progress note with all required sections
5. Creates new document with processed note
6. Links new document back to original transcript
7. Marks original as processed

### 3. Batch Processing

**Process multiple transcripts at once:**

```javascript
POST /api/documents/batch-process-transcripts
{
  "limit": 10  // Optional, defaults to 10
}

// Response
{
  "message": "Batch processing complete: 8 processed, 2 failed",
  "processed": 8,
  "failed": 2,
  "results": [
    {
      "documentId": "doc-1",
      "success": true
    },
    // ...
  ]
}
```

### 4. Check Processing Status

**Get all documents needing processing:**

```javascript
GET /api/documents/needs-processing

// Response
[
  {
    "id": "doc-123",
    "fileName": "Session_Transcript_7-5-2024.pdf",
    "clientId": "client-456",
    "sessionId": "session-789",
    "metadata": {
      "documentFormat": {
        "type": "transcript",
        "needsProcessing": true,
        "processingNotes": "Raw transcript requiring conversion"
      }
    }
  }
]
```

## Generated Progress Note Structure

The AI generates a comprehensive clinical progress note with:

### Main Sections

1. **Title**: "Comprehensive Clinical Progress Note for [Client Name]'s Therapy Session on [Date]"

2. **Subjective**
   - Client's self-reported experience
   - Direct quotes capturing emotional state
   - Connection to previous sessions and treatment themes

3. **Objective**
   - Mental status observations (appearance, behavior, speech, mood, affect)
   - Non-verbal communication and body language
   - Observable defenses and coping mechanisms

4. **Assessment**
   - Current diagnostic formulation
   - Analysis of psychological patterns and core beliefs
   - Connection to developmental history and attachment patterns
   - Progress toward treatment goals

5. **Plan**
   - Specific therapeutic interventions with rationale
   - Treatment modality specifications (ACT, DBT, CBT, Narrative Therapy)
   - Homework assignments
   - Goals for upcoming sessions

### Supplemental Analyses

6. **Tonal Analysis**
   - Significant shifts in client's tone during session
   - Clinical significance of emotional transitions

7. **Thematic Analysis**
   - Major psychological themes that emerged
   - Connection to client's broader treatment narrative

8. **Sentiment Analysis**
   - Emotional valence toward self, others, situations
   - Intensity tracking across domains

9. **Key Points**
   - 2-3 critical clinical insights
   - Most relevant observations for treatment planning

10. **Significant Quotes**
    - Particularly revealing client statements
    - Clinical significance explained

11. **Comprehensive Narrative Summary**
    - Integrative summary (2-3 paragraphs)
    - Weaves together observations, themes, and treatment direction

## Example Workflow

### Scenario: 7/5/2024 Therapy Session

**Step 1: Upload Transcript**
```
File: "Session_7-5-2024_Transcript.pdf"
Content:
"Therapist: How are you feeling today?
Client: I've been better. The job loss is still weighing on me.
Therapist: Tell me more about that..."
```

**AI Detection:**
- Category: "Session Note"
- Format: "transcript" (needsProcessing=TRUE)
- Auto-links to 7/5/2024 appointment

**Step 2: Process Transcript**
```bash
curl -X POST http://localhost:5000/api/documents/doc-123/process-transcript
```

**Step 3: AI Generates Progress Note**

Creates comprehensive clinical note:

```
Comprehensive Clinical Progress Note for Carlos Martinez's Therapy Session on July 5, 2024

Subjective
Carlos attended today's session expressing significant distress about his recent
job loss. He appeared visibly agitated when describing the termination meeting,
stating, "They didn't even give me a chance to explain my side of things..."

[Full clinical documentation with all sections...]

Plan
Acceptance and Commitment Therapy (ACT) Interventions: Continue to utilize ACT
framework to address Carlos's experiential avoidance and emotional disconnection.
In today's session, we introduced the concept of "clean" versus "dirty" pain...

[Detailed treatment plan...]
```

**Step 4: Result**

Two documents now linked to 7/5/2024 appointment:
1. **Original Transcript** (marked as processed)
   - Category: "Session Note"
   - Format: "transcript"
   - needsProcessing: ~~TRUE~~ (processed)
   - Links to processed version

2. **Generated Progress Note** (ready to use)
   - Category: "Session Note"
   - Format: "progress_note"
   - needsProcessing: FALSE
   - Professional clinical documentation

## Clinical Frameworks Integrated

The AI uses expertise from multiple therapeutic modalities:

- **ACT (Acceptance and Commitment Therapy)**: Psychological flexibility, values-based action
- **DBT (Dialectical Behavior Therapy)**: Emotion regulation, distress tolerance
- **Narrative Therapy**: Externalizing problems, alternative stories
- **Existential Therapy**: Meaning-making, authentic living
- **CBT (Cognitive Behavioral Therapy)**: Thought patterns, behavioral interventions

## Database Schema

```sql
-- Original transcript
documents {
  id: "doc-123",
  category: "Session Note",
  sessionId: "session-789",
  content: "Therapist: ... Client: ...",
  isProcessed: true,
  metadata: {
    documentFormat: {
      type: "transcript",
      needsProcessing: true
    },
    processedDocumentId: "doc-456",  // Links to processed version
    processedAt: "2024-07-05T19:30:00Z"
  }
}

-- Generated progress note
documents {
  id: "doc-456",
  category: "Session Note",
  sessionId: "session-789",  // Same session!
  content: "Comprehensive Clinical Progress Note...",
  isProcessed: true,
  metadata: {
    documentFormat: {
      type: "progress_note",
      needsProcessing: false
    },
    sourceTranscriptId: "doc-123",  // Links back to transcript
    processedAt: "2024-07-05T19:30:00Z",
    processingMethod: "comprehensive_clinical_prompt"
  }
}
```

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/upload` | POST | Upload documents (auto-detects format) |
| `/api/documents/:id/process-transcript` | POST | Convert transcript to progress note |
| `/api/documents/batch-process-transcripts` | POST | Batch process multiple transcripts |
| `/api/documents/needs-processing` | GET | List transcripts needing conversion |
| `/api/sessions/:sessionId/documents` | GET | Get all documents for a session |

## Best Practices

### For Therapists

1. **Upload transcripts promptly** after sessions
2. **Review AI-generated notes** before finalizing
3. **Use batch processing** for efficiency
4. **Keep both versions**: Original transcript + processed note
5. **Verify client/session linking** before processing

### For System Administration

1. **Rate limiting**: Batch processing includes 2-second delays between documents
2. **Error handling**: Failed processing doesn't affect original document
3. **Audit trail**: Full processing history maintained
4. **Token limits**: AI generation capped at 4000 tokens per note
5. **Temperature setting**: 0.3 for consistent clinical writing

## Benefits

### Clinical Benefits
- **Professional documentation** meeting clinical standards
- **Time savings** from automated note generation
- **Comprehensive analysis** covering multiple frameworks
- **Consistent quality** across all progress notes
- **Rich clinical insights** from supplemental analyses

### Practice Benefits
- **Improved record keeping** with detailed documentation
- **Better case conceptualization** through thematic analysis
- **Enhanced treatment planning** with actionable insights
- **Professional development** through exposure to expert-level notes
- **Compliance** with documentation standards

## Troubleshooting

### Document Not Processing

**Issue**: "Document does not need processing"
**Solution**: Check that `documentFormat.needsProcessing === true`

### Processing Failed

**Issue**: "Failed to generate progress note"
**Solutions**:
- Verify document has content
- Check AI service availability
- Review token limits
- Ensure proper session/client linking

### Missing Client Name

**Issue**: Progress note shows "Client" instead of name
**Solution**: Ensure document is linked to a client before processing

## Future Enhancements

Potential improvements:
- Custom prompt templates per therapist
- Editing interface for AI-generated notes
- Version control for processed notes
- Quality metrics and feedback loop
- Multi-language support
- Voice-to-text integration

## Support

For issues or questions:
- Check logs: `[Transcript Processor]` tags
- Review document metadata
- Verify AI service configuration
- Test with sample transcript

---

**System Status**: Production Ready ✅
**Last Updated**: 2025-10-28
**Version**: 1.0.0
