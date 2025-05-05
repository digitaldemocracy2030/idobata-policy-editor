import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";
import { generateSharpQuestions } from "../workers/questionGenerator.js";

// Controller to trigger the sharp question generation process
const triggerQuestionGeneration = async (req, res) => {
  console.log(
    "[AdminController] Received request to generate sharp questions."
  );
  try {
    // Call the generation function (non-blocking, but we'll wait for it here for simplicity in manual trigger)
    // In a production scenario, this might add a job to a queue instead of direct execution.
    await generateSharpQuestions();

    res.status(202).json({
      message: "Sharp question generation process started successfully.",
    });
  } catch (error) {
    console.error(
      "[AdminController] Error triggering question generation:",
      error
    );
    res
      .status(500)
      .json({ message: "Failed to start sharp question generation process." });
  }
};

const getProblemsByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(`[AdminController] Fetching problems for theme ${themeId}`);
  try {
    const problems = await Problem.find({ themeId }).sort({ createdAt: -1 });
    res.status(200).json(problems);
  } catch (error) {
    console.error(
      `[AdminController] Error fetching problems for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch problems for theme",
      error: error.message,
    });
  }
};

const getSolutionsByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(`[AdminController] Fetching solutions for theme ${themeId}`);
  try {
    const solutions = await Solution.find({ themeId }).sort({ createdAt: -1 });
    res.status(200).json(solutions);
  } catch (error) {
    console.error(
      `[AdminController] Error fetching solutions for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch solutions for theme",
      error: error.message,
    });
  }
};

const triggerQuestionGenerationByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(
    `[AdminController] Received request to generate sharp questions for theme ${themeId}`
  );
  try {
    await generateSharpQuestions(themeId);

    res.status(202).json({
      message: "Sharp question generation process started successfully.",
    });
  } catch (error) {
    console.error(
      `[AdminController] Error triggering question generation for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to start sharp question generation process for theme",
      error: error.message,
    });
  }
};

export {
  getProblemsByTheme,
  getSolutionsByTheme,
  triggerQuestionGenerationByTheme,
};
