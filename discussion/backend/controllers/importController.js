import ImportedItem from '../models/ImportedItem.js'; // Use import and add .js extension
// Import the extraction worker function directly
import { processExtraction } from '../workers/extractionWorker.js';

/**
 * @description Handle generic data import (e.g., tweets)
 * @route POST /api/import/generic
 * @access Private (or Public, depending on requirements)
 */
export const importGenericData = async (req, res, next) => { // Use export const
  const { sourceType, content, metadata } = req.body;

  // Basic validation
  if (!sourceType || !content) {
    return res.status(400).json({ success: false, message: 'Missing required fields: sourceType and content' });
  }

  // No validation for sourceType - allowing any string value

  try {
    // Create the item in the database
    const newItem = await ImportedItem.create({
      sourceType,
      content,
      metadata: metadata || {}, // Ensure metadata is at least an empty object
      status: 'pending',
    });

    // Add a job to the extraction queue
    // This part depends on the specific job queue implementation
    // Example using a hypothetical 'extractionQueue.add'
    // Trigger asynchronous extraction using setTimeout, similar to chatController
    setTimeout(() => {
      // Construct the job data object expected by processExtraction
      const jobData = {
        sourceType: newItem.sourceType,
        sourceOriginId: newItem._id.toString(), // Pass ID as string
        content: newItem.content,
        metadata: newItem.metadata,
      };
      // Call processExtraction with a mock job structure { data: jobData }
      // The worker expects job.data
      processExtraction({ data: jobData }).catch(err => {
        console.error(`[Async Extraction Call] Error for imported item ${newItem._id}:`, err);
      });
      console.log(`[ImportController] Triggered async extraction for item ${newItem._id}`);
    }, 0);

    res.status(201).json({ success: true, data: newItem });

  } catch (error) {
    console.error('Error importing generic data:', error);
    res.status(500).json({ success: false, message: 'Server error during import' });
  }
};