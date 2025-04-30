import mongoose from "mongoose";
import ChatThread from "./models/ChatThread.js";

export function setupChangeStreams(notifyClients) {
  if (!mongoose.connection.readyState) {
    console.error(
      "MongoDB connection not established. Change streams require an active connection."
    );
    return;
  }

  const chatThreadChangeStream = ChatThread.watch(
    [
      {
        $match: {
          "updateDescription.updatedFields": {
            $or: [
              { $regex: /^extractedProblemIds/ },
              { $regex: /^extractedSolutionIds/ },
            ],
          },
        }
      }
    ],
    { fullDocument: "updateLookup" }
  );

  chatThreadChangeStream.on("change", async (change) => {
    if (change.operationType === "update") {
      const threadId = change.documentKey._id.toString();
      const fullDocument = change.fullDocument;

      if (fullDocument) {
        const problems = await mongoose.model("Problem").find({
          _id: { $in: fullDocument.extractedProblemIds },
        });
        const solutions = await mongoose.model("Solution").find({
          _id: { $in: fullDocument.extractedSolutionIds },
        });

        notifyClients(threadId, {
          type: "extraction_update",
          threadId,
          extractions: {
            problems,
            solutions,
          },
        });
      }
    }
  });

  console.log("Change Streams set up successfully for ChatThread collection");
}
