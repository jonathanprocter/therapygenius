import { Document } from "@shared/schema";
import { aiRouter } from "./ai";
import { storage } from "./storage";

/**
 * Comprehensive Clinical Progress Note Generation
 * Converts raw therapy session transcripts into professionally formatted clinical progress notes
 */

const COMPREHENSIVE_CLINICAL_PROMPT = `Comprehensive Clinical Progress Note Generation Prompt

Overview
You are an expert clinical therapist with extensive training in psychotherapy, clinical documentation, and therapeutic modalities including ACT, DBT, Narrative Therapy, and Existentialism. Your task is to create a comprehensive clinical progress note from the provided therapy session transcript that demonstrates the depth, clinical sophistication, and analytical rigor of an experienced mental health professional.

Document Formatting Requirements
- Title Format: Bold, centered title with client name and session date
- Section Headers Format: Bold headers for each major section (Subjective, Objective, Assessment, Plan, etc.)
- Text Formatting: Regular paragraph text with proper clinical terminology
- Specific Section Formatting: Subsections within each major section with clear hierarchical structure

Required Document Structure

Create a progress note with the following precise structure:

**Title: "Comprehensive Clinical Progress Note for [Client's Full Name]'s Therapy Session on [Date]"**

**Subjective Section:**
Document the client's self-reported experience, including:
- Direct quotes that capture the client's emotional state and perspective
- The client's narrative about presenting concerns, stressors, and recent events
- Subjective symptoms reported by the client
- The client's own assessment of their progress or setbacks

Connect these reports to previous sessions and treatment themes. Demonstrate understanding of how current statements relate to the client's broader therapeutic narrative.

Example:
*Subjective*
Carlos attended today's session expressing significant distress about his recent job loss. He appeared visibly agitated when describing the termination meeting, stating, "They didn't even give me a chance to explain my side of things. They just called me in and told me it was over." This statement reflects Carlos's sense of powerlessness and injustice regarding the situation, themes that have emerged in previous sessions related to his childhood experiences of having his perspective dismissed by authority figures.

When discussing his emotional response to the job loss, Carlos described feeling "completely hollowed out" and "like I'm just going through the motions." These descriptions suggest a significant depressive response characterized by emotional numbness and detachment rather than acute emotional pain. This pattern is consistent with Carlos's typical response to perceived rejection, where he tends to disconnect from painful emotions as a protective mechanism.

**Objective Section:**
Document observable clinical findings including:
- Mental status observations (appearance, behavior, speech, mood, affect, thought process/content)
- Non-verbal communication and body language
- Observable changes in affect or demeanor during the session
- Clinical observations about defenses, coping mechanisms, or interpersonal patterns

Example:
*Objective*
Carlos presented to the session casually dressed but well-groomed. He was alert and oriented, with clear speech and logical thought progression. His affect was notably constricted throughout most of the session, with limited range of emotional expression even when discussing distressing content. This emotional constriction appeared to be a defensive posture rather than a symptom of severe depression, as he showed momentary breaks in this pattern when discussing his children.

When describing the termination meeting, Carlos's body language became notably tense, with visible tightening of his jaw and shoulders. He maintained minimal eye contact during this portion of the session, frequently looking down or away. These physical manifestations of distress contrasted with his verbally reported emotional numbness, suggesting that his conscious experience of emotional detachment may be a defensive mechanism against more painful feelings of shame and rejection.

**Assessment Section:**
Provide clinical analysis including:
- Current diagnostic formulation and symptom assessment
- Analysis of psychological patterns, defenses, and core beliefs evident in the session
- Connection to developmental history and attachment patterns
- Progress toward treatment goals
- Clinical formulation of the presenting problems and maintaining factors

Example:
*Assessment*
Carlos continues to meet criteria for Major Depressive Disorder (F33.1, moderate, recurrent) as evidenced by persistent low mood, anhedonia, sleep disturbance, fatigue, and feelings of worthlessness. His recent job loss has exacerbated these symptoms, particularly his negative self-perception and sense of hopelessness about the future. The emotional numbing he describes appears to be a manifestation of his depression rather than a separate dissociative process, functioning as a defense against overwhelming feelings of shame and failure.

A significant pattern observed today was Carlos's tendency to intellectualize emotional content, particularly when discussing the job loss. He focused extensively on the procedural unfairness of the termination while avoiding exploration of his emotional response. This pattern reflects his core belief that emotional vulnerability is dangerous and will lead to rejection or humiliation, a belief rooted in early attachment experiences with critical caregivers who punished emotional expression.

**Plan Section:**
Detail the therapeutic plan moving forward:
- Specific therapeutic interventions and their rationale
- Homework assignments with clear objectives
- Treatment modality specifications (ACT, DBT, CBT, Narrative Therapy, etc.)
- Goals for upcoming sessions
- Any referrals, medication considerations, or safety planning

Example:
*Plan*
Acceptance and Commitment Therapy (ACT) Interventions: Continue to utilize ACT framework to address Carlos's experiential avoidance and emotional disconnection. In today's session, we introduced the concept of "clean" versus "dirty" pain, helping Carlos recognize how his attempts to avoid the natural pain of job loss (clean pain) are creating additional suffering through self-criticism and rumination (dirty pain). We will continue to develop his psychological flexibility through mindfulness practices that allow him to observe painful thoughts and feelings without becoming fused with them.

Narrative Therapy Elements: Incorporate narrative therapy approaches to help Carlos externalize the "failure" story that has become dominant following his job loss. We began this process today by identifying times in his life when he has successfully navigated setbacks, creating space for an alternative narrative of resilience. For homework, Carlos will write about three previous challenges he has overcome, focusing on the personal strengths and resources he utilized.

Behavioral Activation: Implement structured behavioral activation to counter Carlos's withdrawal and inactivity. We collaboratively developed a daily schedule that includes one pleasurable activity and one mastery activity each day, regardless of mood. Carlos will track his mood before and after these activities using the provided mood monitoring sheet.

**Supplemental Analyses:**

**Tonal Analysis:**
Identify and analyze significant shifts in the client's tone, emotional expression, or interpersonal stance during the session. Explain the clinical significance of these shifts.

Example:
*Tonal Analysis*
Shift 1: From Detached to Angry
A significant tonal shift occurred when Carlos moved from describing the factual circumstances of his termination to recounting his manager's specific words. His tone shifted from flat and emotionally detached to tense and angry, with increased volume and sharper articulation. This shift was triggered specifically when he recalled his manager saying, "We need someone more reliable in this position." The sudden emergence of anger through his otherwise constricted affect suggests that the perceived character attack touched on Carlos's core fear of being fundamentally inadequate. This tonal shift is clinically significant as it represents a momentary break in his emotional avoidance, providing access to the authentic feelings beneath his defensive numbness.

Shift 2: From Angry to Resigned
Following the expression of anger, Carlos's tone shifted to one of resignation and defeat when discussing his job prospects. His voice became quieter, his speech slowed, and his language shifted to include more absolute terms like "never" and "always." This shift occurred when I asked about his plans for finding new employment. The resigned tone reflected his underlying hopelessness and catastrophic thinking patterns, where one setback is interpreted as evidence of inevitable, permanent failure.

**Thematic Analysis:**
Identify major psychological themes that emerged in the session and explain their clinical significance in relation to the client's treatment.

Example:
*Thematic Analysis*
Theme 1: Perceived Injustice and Powerlessness
A dominant theme throughout today's session was Carlos's sense of injustice and powerlessness in relation to authority figures. This theme was evident in his description of the termination meeting: "They didn't even give me a chance to explain my side of things" and "It was like they had already made up their minds before I walked in." This theme connects to Carlos's early experiences with his father, who made unilateral decisions affecting the family and punished any questioning of his authority. The current employment situation has reactivated this core wound, triggering the familiar feeling of being subject to arbitrary power without recourse.

Theme 2: Self-Worth Contingent on Professional Identity
A second significant theme was the fusion between Carlos's sense of self-worth and his professional identity. This theme was evident in statements such as "Without my job, I don't even know who I am anymore" and his description of himself as "just another unemployed loser." This theme connects to Carlos's developmental history, where he received recognition and approval primarily for achievements rather than inherent qualities.

**Sentiment Analysis:**
Analyze the emotional valence and intensity of the client's expressions toward self, others, and situations.

Example:
*Sentiment Analysis*
Sentiments About Self: Carlos's expressions about himself were predominantly negative, characterized by themes of inadequacy, shame, and hopelessness. The most frequently expressed sentiments were:
1. Worthlessness: "I'm basically worthless without a job"
2. Helplessness: "There's nothing I can do to fix this"
3. Shame: "I feel like everyone can tell just by looking at me that I got fired"

Sentiments About Others/External Situations: Mixed but predominantly negative:
1. Resentment toward Authority: "They were just looking for an excuse to get rid of me"
2. Pessimism about Systems: "The unemployment system is deliberately designed to make people give up"
3. Ambivalence toward Support Network: "My sister has been trying to help" but "Nobody really understands"

**Key Points:**
Highlight 2-3 critical clinical insights from the session that are most relevant to treatment planning and case conceptualization.

Example:
*Key Points*
• Emotional Avoidance as Primary Coping Strategy: Carlos's emotional numbing and intellectualization in response to job loss represent his primary coping strategies for managing painful feelings. These strategies provide short-term relief but prevent processing of emotions necessary for adaptation and resilience.

• Identity Crisis Precipitated by Job Loss: The loss of employment has triggered a significant identity crisis for Carlos, revealing the extent to which his self-concept is contingent on professional role and achievement. This crisis presents both a challenge and opportunity for treatment.

**Significant Quotes:**
Include 2-3 particularly revealing client quotes with analysis of their clinical significance.

Example:
*Significant Quotes*
"Without my job, I don't even know who I am anymore." - This quote reveals the extent to which Carlos's identity has been fused with his professional role, leaving him with a profound sense of disorientation when that role is removed. The statement suggests an external locus of identity, where self-concept is derived primarily from roles and external validation rather than intrinsic qualities or values.

"I keep waiting to feel something—anything—but it's like I'm completely hollow inside." - This quote highlights Carlos's dissociation from painful emotions, a defense mechanism that protects him from overwhelming feelings of shame and failure but also prevents emotional processing and resolution.

**Comprehensive Narrative Summary:**
Provide an integrative summary (2-3 paragraphs) that weaves together the clinical observations, themes, and treatment direction in a coherent narrative.

Example:
*Comprehensive Narrative Summary*
Today's session with Carlos represented a critical juncture in his treatment, as we navigated the psychological impact of his recent job loss against the backdrop of his recurrent depression and longstanding identity concerns. The session revealed both the vulnerability created by this acute stressor and the opportunity it presents for addressing core psychological patterns that have maintained his suffering.

Carlos entered the session presenting with emotional constriction and intellectual defensiveness, attempting to manage his distress through detachment and rationalization. As the session progressed, however, cracks in this defensive structure became visible—moments of anger breaking through when recounting his manager's words, fleeting expressions of shame when discussing telling his family, and profound resignation when contemplating future prospects.

Clinical Approach Requirements

Your analysis must demonstrate:

**Depth of Clinical Thinking:**
- Move beyond surface-level observations to reveal underlying psychological dynamics
- Connect current session material to developmental history, attachment patterns, and core beliefs
- Demonstrate understanding of defense mechanisms and how they function to protect the client

**Therapeutic Perspective:**
- View the client with compassion and clinical curiosity rather than judgment
- Recognize both vulnerability and resilience
- Frame symptoms and behaviors as adaptive responses to difficult circumstances

**Integration of Therapeutic Frameworks:**
- Explicitly identify which therapeutic modalities (ACT, DBT, Narrative Therapy, CBT, Existential) are being employed
- Explain the rationale for chosen interventions
- Demonstrate sophisticated understanding of multiple therapeutic approaches

**Clinical Sophistication:**
- Use appropriate clinical terminology accurately
- Demonstrate diagnostic reasoning
- Show awareness of ethical considerations and professional standards

Writing Style Requirements

**Professional Clinical Voice:**
- Maintain formal, professional tone throughout
- Use clinical terminology appropriately and accurately
- Balance objective description with insightful analysis

**Structural Integrity:**
- Follow the prescribed structure precisely
- Maintain clear transitions between sections
- Ensure each section serves its specific purpose

**Depth and Detail:**
- Provide rich, detailed descriptions rather than superficial summaries
- Include specific examples and quotes to support clinical observations
- Demonstrate thorough analysis rather than cursory assessment

**Narrative Cohesion:**
- Create a coherent story that connects all elements of the session
- Show how different observations relate to each other and to the broader treatment narrative
- Maintain thematic consistency throughout the document

Final Formatting Requirements

The final progress note must be delivered with NO visible markdown syntax. All formatting (bold, italics, headings) should be properly rendered in the final document.

The final product should be a clinically sophisticated, detailed, and comprehensive progress note that would meet the highest standards of professional documentation in a mental health setting. It should demonstrate both clinical expertise and therapeutic wisdom while providing actionable insights for ongoing treatment.

---

NOW PROCESS THE FOLLOWING TRANSCRIPT:

Client Name: {clientName}
Session Date: {sessionDate}
Transcript:
{transcript}

Generate a comprehensive clinical progress note following all requirements above.`;

/**
 * Convert a therapy session transcript into a comprehensive clinical progress note
 */
export const convertTranscriptToProgressNote = async (
  document: Document,
  clientName: string,
  sessionDate: string,
  therapistId: string
): Promise<{
  success: boolean;
  progressNote?: string;
  error?: string;
}> => {
  try {
    console.log(`[Transcript Processor] Converting transcript ${document.id} to progress note`);

    if (!document.content) {
      throw new Error('Document has no content to process');
    }

    // Format the prompt with actual data
    const formattedPrompt = COMPREHENSIVE_CLINICAL_PROMPT
      .replace('{clientName}', clientName)
      .replace('{sessionDate}', sessionDate)
      .replace('{transcript}', document.content);

    // Use AI to generate comprehensive progress note
    const progressNote = await aiRouter.chat([
      {
        role: 'system',
        content: 'You are an expert clinical therapist creating comprehensive progress notes. Follow all formatting and content requirements precisely. Do not use markdown syntax in your output - format should be clean text with proper structure.'
      },
      {
        role: 'user',
        content: formattedPrompt
      }
    ], {
      maxTokens: 4000,
      temperature: 0.3 // Lower temperature for more consistent clinical writing
    });

    console.log(`[Transcript Processor] Successfully generated progress note for document ${document.id}`);

    return {
      success: true,
      progressNote
    };

  } catch (error) {
    console.error('[Transcript Processor] Error converting transcript:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Process a document marked as needing processing (transcript conversion)
 * This updates the document with the generated progress note
 */
export const processTranscriptDocument = async (
  documentId: string,
  therapistId: string
): Promise<{
  success: boolean;
  processedDocumentId?: string;
  error?: string;
}> => {
  try {
    console.log(`[Transcript Processor] Processing document ${documentId}`);

    // Get the document
    const document = await storage.getDocumentById(documentId, therapistId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Verify it needs processing
    const metadata = document.metadata as any;
    const documentFormat = metadata?.documentFormat;

    if (!documentFormat?.needsProcessing) {
      return {
        success: false,
        error: 'Document does not need processing'
      };
    }

    // Get client information for the note
    let clientName = 'Client';
    if (document.clientId) {
      const client = await storage.getClientById(document.clientId, therapistId);
      if (client) {
        clientName = `${client.firstName} ${client.lastName}`;
      }
    }

    // Get session date if linked
    let sessionDate = new Date().toLocaleDateString();
    if (document.sessionId) {
      const session = await storage.getSessionById(document.sessionId, therapistId);
      if (session) {
        sessionDate = new Date(session.sessionDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }

    // Convert transcript to progress note
    const result = await convertTranscriptToProgressNote(
      document,
      clientName,
      sessionDate,
      therapistId
    );

    if (!result.success || !result.progressNote) {
      throw new Error(result.error || 'Failed to generate progress note');
    }

    // Create new document with the processed progress note
    const processedDoc = await storage.createDocument({
      therapistId,
      clientId: document.clientId,
      sessionId: document.sessionId,
      fileName: document.fileName.replace(/transcript/i, 'Progress_Note'),
      fileType: 'text/plain',
      fileSize: result.progressNote.length,
      filePath: document.filePath + '_processed',
      content: result.progressNote,
      sourceEventId: document.sourceEventId,
      isProcessed: true,
      metadata: {
        ...metadata,
        documentFormat: {
          type: 'progress_note',
          needsProcessing: false,
          processingNotes: 'Generated from transcript using comprehensive clinical prompt'
        },
        sourceTranscriptId: document.id,
        processedAt: new Date().toISOString(),
        processingMethod: 'comprehensive_clinical_prompt'
      }
    });

    // Update original document to mark as processed
    await storage.updateDocument(document.id, {
      isProcessed: true,
      metadata: {
        ...metadata,
        processedDocumentId: processedDoc.id,
        processedAt: new Date().toISOString()
      }
    }, therapistId);

    console.log(`[Transcript Processor] Successfully processed document ${documentId}, created ${processedDoc.id}`);

    return {
      success: true,
      processedDocumentId: processedDoc.id
    };

  } catch (error) {
    console.error('[Transcript Processor] Error processing transcript document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Batch process all transcripts that need processing for a therapist
 */
export const batchProcessTranscripts = async (
  therapistId: string,
  limit: number = 10
): Promise<{
  processed: number;
  failed: number;
  results: Array<{ documentId: string; success: boolean; error?: string }>;
}> => {
  try {
    console.log(`[Transcript Processor] Batch processing transcripts for therapist ${therapistId}`);

    // Get all documents that need processing
    const documents = await storage.getDocumentsByTherapist(therapistId);
    const transcriptsToProcess = documents
      .filter(doc => {
        const metadata = doc.metadata as any;
        return metadata?.documentFormat?.needsProcessing && !doc.isProcessed;
      })
      .slice(0, limit);

    console.log(`[Transcript Processor] Found ${transcriptsToProcess.length} transcripts to process`);

    const results: Array<{ documentId: string; success: boolean; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const doc of transcriptsToProcess) {
      const result = await processTranscriptDocument(doc.id, therapistId);
      results.push({
        documentId: doc.id,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      // Add delay between processing to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[Transcript Processor] Batch processing complete: ${processed} processed, ${failed} failed`);

    return { processed, failed, results };

  } catch (error) {
    console.error('[Transcript Processor] Error in batch processing:', error);
    throw error;
  }
};
