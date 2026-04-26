// Word sources for typing practice

export type TypingMode = "random" | "quote" | "normal" | "drill" | "free";
export type WordSource = "common" | "encyclopedia" | "quotes" | "code" | "numbers";

export interface TypingConfig {
  mode: TypingMode;
  wordSource?: WordSource; // Optional since new modes don't use this
  wordCount?: number | "infinite"; // Number of words to display (30, 60, 100, or infinite)
  timeLimit?: number; // For legacy modes (in seconds)
  includeNumbers?: boolean;
  includePunctuation?: boolean;
}

// Common English words (top 200)
export const commonWords = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "still", "during", "point", "line", "general", "face", "little", "without", "run", "word",
  "again", "present", "course", "change", "turn", "should", "head", "state", "down", "side",
  "been", "call", "find", "long", "down", "day", "did", "get", "come", "made",
  "may", "part", "sound", "place", "right", "old", "great", "where", "help", "through",
  "much", "before", "line", "right", "too", "mean", "same", "tell", "boy", "follow",
  "came", "want", "show", "also", "around", "form", "small", "set", "put", "end",
  "does", "another", "home", "read", "hand", "port", "large", "spell", "add", "land",
  "here", "must", "big", "high", "such", "went", "kind", "need", "house", "picture",
  "try", "again", "animal", "point", "mother", "world", "near", "build", "self", "earth",
  "father", "head", "stand", "own", "page", "should", "country", "found", "answer", "school"
];

// Encyclopedia-style educational content
export const encyclopediaContent = [
  // Science
  "The human brain contains approximately 86 billion neurons that communicate through electrical and chemical signals creating complex neural networks",
  "Photosynthesis is the process by which plants convert sunlight water and carbon dioxide into glucose and oxygen using chlorophyll",
  "The speed of light in a vacuum is approximately 299792 kilometers per second making it the fastest known speed in the universe",
  "DNA or deoxyribonucleic acid carries genetic instructions for the development functioning growth and reproduction of all known organisms",
  "Black holes are regions of spacetime where gravity is so strong that nothing not even light or other electromagnetic waves can escape",
  "The periodic table organizes chemical elements by their atomic number electron configuration and recurring chemical properties",
  "Quantum mechanics describes the behavior of matter and energy at the molecular atomic nuclear and even smaller microscopic levels",
  "Evolution by natural selection is the process by which organisms change over time as a result of heritable physical or behavioral traits",
  
  // History
  "The Renaissance was a cultural movement that began in Italy during the 14th century and spread throughout Europe over the following centuries",
  "The Industrial Revolution marked a major turning point in history as it influenced almost every aspect of daily life in some way",
  "Ancient Egypt was a civilization of ancient North Africa concentrated along the lower reaches of the Nile River in the place that is now Egypt",
  "The Roman Empire at its height controlled territories stretching from Britain to Mesopotamia and from the Rhine to the Sahara Desert",
  "The French Revolution was a period of radical political and societal change in France that began with the Estates General of 1789",
  "World War II was a global conflict that lasted from 1939 to 1945 involving most of the world nations including all the great powers",
  
  // Geography
  "Mount Everest is the highest mountain on Earth above sea level located in the Mahalangur Himal sub range of the Himalayas",
  "The Amazon River is the largest river by discharge volume of water in the world and the disputed longest river in the world",
  "The Pacific Ocean is the largest and deepest of Earth oceanic divisions extending from the Arctic Ocean in the north to the Southern Ocean",
  "The Sahara Desert is the largest hot desert in the world and the third largest desert overall after Antarctica and the Arctic",
  
  // Technology
  "Artificial intelligence is intelligence demonstrated by machines as opposed to natural intelligence displayed by animals including humans",
  "The internet is a global system of interconnected computer networks that uses the Internet protocol suite to communicate between networks",
  "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed",
  "Blockchain is a distributed ledger technology that maintains a continuously growing list of records called blocks linked using cryptography",
  
  // Literature
  "William Shakespeare was an English playwright poet and actor widely regarded as the greatest writer in the English language",
  "The Odyssey is one of two major ancient Greek epic poems attributed to Homer following the Greek hero Odysseus on his journey home",
  "Pride and Prejudice is a romantic novel of manners written by Jane Austen first published in 1813 exploring themes of love and society",
  
  // Philosophy
  "Philosophy is the study of fundamental questions about existence knowledge values reason mind and language through critical analysis",
  "Existentialism is a philosophical movement that emphasizes individual existence freedom and choice as the basis of human meaning",
  "The Socratic method is a form of cooperative argumentative dialogue between individuals based on asking and answering questions"
];

// Famous quotes
export const famousQuotes = [
  // Shakespeare
  "To be or not to be that is the question whether it is nobler in the mind to suffer the slings and arrows of outrageous fortune",
  "All the world is a stage and all the men and women merely players they have their exits and their entrances",
  "What is in a name that which we call a rose by any other name would smell as sweet",
  "To thine own self be true and it must follow as the night the day thou canst not then be false to any man",
  "The better part of valor is discretion",
  "Cowards die many times before their deaths the valiant never taste of death but once",
  "Brevity is the soul of wit",
  "All that glitters is not gold",
  "The course of true love never did run smooth",
  "We are such stuff as dreams are made on and our little life is rounded with a sleep",
  
  // MLK and Civil Rights
  "I have a dream that one day this nation will rise up and live out the true meaning of its creed we hold these truths to be self evident that all men are created equal",
  "I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character",
  "The arc of the moral universe is long but it bends toward justice",
  "Injustice anywhere is a threat to justice everywhere we are caught in an inescapable network of mutuality tied in a single garment of destiny",
  "Darkness cannot drive out darkness only light can do that hate cannot drive out hate only love can do that",
  "Faith is taking the first step even when you do not see the whole staircase",
  "The time is always right to do what is right",
  
  // Historical and Philosophical
  "The only thing we have to fear is fear itself",
  "In the middle of difficulty lies opportunity",
  "Be the change you wish to see in the world",
  "The journey of a thousand miles begins with a single step",
  "I think therefore I am",
  "The unexamined life is not worth living",
  "Knowledge is power",
  "That which does not kill us makes us stronger",
  "The only true wisdom is in knowing you know nothing",
  "Life is what happens when you are busy making other plans",
  "The greatest glory in living lies not in never falling but in rising every time we fall",
  "The way to get started is to quit talking and begin doing",
  "Your time is limited so do not waste it living someone else life",
  "If life were predictable it would cease to be life and be without flavor",
  "Spread love everywhere you go let no one ever come to you without leaving happier",
  "When you reach the end of your rope tie a knot in it and hang on",
  "Always remember that you are absolutely unique just like everyone else",
  "Do not judge each day by the harvest you reap but by the seeds that you plant",
  "The future belongs to those who believe in the beauty of their dreams"
];

// Code snippets for programmers
export const codeSnippets = [
  "function calculateSum(array) { return array.reduce((acc, val) => acc + val, 0); }",
  "const fetchData = async (url) => { const response = await fetch(url); return response.json(); }",
  "class Rectangle { constructor(width, height) { this.width = width; this.height = height; } }",
  "const filterEven = (numbers) => numbers.filter(num => num % 2 === 0);",
  "export default function Component({ props }) { return <div>{props.children}</div>; }",
  "const debounce = (fn, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); }; }",
  "interface User { id: string; name: string; email: string; createdAt: Date; }",
  "const memoize = (fn) => { const cache = {}; return (arg) => cache[arg] || (cache[arg] = fn(arg)); }"
];

// Scientific and factual statements for Normal mode
export const factualStatements = [
  "Mount Everest is the highest mountain on Earth above sea level located in the Mahalangur Himal sub range of the Himalayas in Nepal",
  "The human brain contains approximately 86 billion neurons that communicate through electrical and chemical signals creating complex neural networks",
  "Photosynthesis is the process by which plants convert sunlight water and carbon dioxide into glucose and oxygen using chlorophyll",
  "The speed of light in a vacuum is approximately 299792 kilometers per second making it the fastest known speed in the universe",
  "DNA or deoxyribonucleic acid carries genetic instructions for the development functioning growth and reproduction of all known organisms",
  "Black holes are regions of spacetime where gravity is so strong that nothing not even light or other electromagnetic waves can escape",
  "The periodic table organizes chemical elements by their atomic number electron configuration and recurring chemical properties",
  "Quantum mechanics describes the behavior of matter and energy at the molecular atomic nuclear and even smaller microscopic levels",
  "Evolution by natural selection is the process by which organisms change over time as a result of heritable physical or behavioral traits",
  "The Renaissance was a cultural movement that began in Italy during the 14th century and spread throughout Europe over the following centuries",
  "The Industrial Revolution marked a major turning point in history as it influenced almost every aspect of daily life in some way",
  "Ancient Egypt was a civilization of ancient North Africa concentrated along the lower reaches of the Nile River in the place that is now Egypt",
  "The Roman Empire at its height controlled territories stretching from Britain to Mesopotamia and from the Rhine to the Sahara Desert",
  "The French Revolution was a period of radical political and societal change in France that began with the Estates General of 1789",
  "World War II was a global conflict that lasted from 1939 to 1945 involving most of the world nations including all the great powers",
  "The Amazon River is the largest river by discharge volume of water in the world and the disputed longest river in the world",
  "The Pacific Ocean is the largest and deepest of Earth oceanic divisions extending from the Arctic Ocean in the north to the Southern Ocean",
  "The Sahara Desert is the largest hot desert in the world and the third largest desert overall after Antarctica and the Arctic",
  "Artificial intelligence is intelligence demonstrated by machines as opposed to natural intelligence displayed by animals including humans",
  "The internet is a global system of interconnected computer networks that uses the Internet protocol suite to communicate between networks",
  "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed",
  "Blockchain is a distributed ledger technology that maintains a continuously growing list of records called blocks linked using cryptography",
  "William Shakespeare was an English playwright poet and actor widely regarded as the greatest writer in the English language",
  "The Odyssey is one of two major ancient Greek epic poems attributed to Homer following the Greek hero Odysseus on his journey home",
  "Pride and Prejudice is a romantic novel of manners written by Jane Austen first published in 1813 exploring themes of love and society",
  "Philosophy is the study of fundamental questions about existence knowledge values reason mind and language through critical analysis",
  "Existentialism is a philosophical movement that emphasizes individual existence freedom and choice as the basis of human meaning",
  "The Socratic method is a form of cooperative argumentative dialogue between individuals based on asking and answering questions"
];

// Generate random text based on configuration
export function generateText(config: TypingConfig): string {
  const { mode, wordSource, wordCount = 100, includeNumbers, includePunctuation } = config;
  
  // Handle the three new modes
  if (mode === "random") {
    // Random mode: get words from encyclopedia and arrange in random order
    let pool: string[] = [];
    const target = wordCount === "infinite" ? 100 : (typeof wordCount === "number" ? wordCount : 100);
    while (pool.length < target) {
      const entry = encyclopediaContent[Math.floor(Math.random() * encyclopediaContent.length)];
      pool = [...pool, ...entry.split(" ")];
    }
    // Shuffle the words randomly
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, target).join(" ");
  }
  
  if (mode === "quote") {
    // Quote mode: return a random famous quote, respecting word count
    const quote = famousQuotes[Math.floor(Math.random() * famousQuotes.length)];
    const words = quote.split(" ");
    
    if (wordCount === "infinite") {
      return quote; // Will be handled by infinite scroll in TypingTest
    }
    
    if (typeof wordCount === "number" && words.length > wordCount) {
      return words.slice(0, wordCount).join(" ");
    }
    
    // If quote is shorter than wordCount, pad with more quotes
    if (typeof wordCount === "number" && words.length < wordCount) {
      let result = [...words];
      while (result.length < wordCount) {
        const additionalQuote = famousQuotes[Math.floor(Math.random() * famousQuotes.length)];
        const additionalWords = additionalQuote.split(" ");
        result = [...result, ...additionalWords];
      }
      return result.slice(0, wordCount).join(" ");
    }
    
    return quote;
  }
  
  if (mode === "normal") {
    // Normal mode: return a scientific/factual statement, respecting word count
    const statement = factualStatements[Math.floor(Math.random() * factualStatements.length)];
    const words = statement.split(" ");
    
    if (wordCount === "infinite") {
      return statement; // Will be handled by infinite scroll in TypingTest
    }
    
    if (typeof wordCount === "number" && words.length > wordCount) {
      return words.slice(0, wordCount).join(" ");
    }
    
    // If statement is shorter than wordCount, pad with more statements
    if (typeof wordCount === "number" && words.length < wordCount) {
      let result = [...words];
      while (result.length < wordCount) {
        const additionalStatement = factualStatements[Math.floor(Math.random() * factualStatements.length)];
        const additionalWords = additionalStatement.split(" ");
        result = [...result, ...additionalWords];
      }
      return result.slice(0, wordCount).join(" ");
    }
    
    return statement;
  }
  
  // Fallback for legacy modes (should not be used with new system)
  let sourceWords: string[] = [];
  
  switch (wordSource) {
    case "common":
      sourceWords = [...commonWords];
      break;
    case "encyclopedia":
      const entry = encyclopediaContent[Math.floor(Math.random() * encyclopediaContent.length)];
      return entry;
    case "quotes":
      const quote = famousQuotes[Math.floor(Math.random() * famousQuotes.length)];
      return quote;
    case "code":
      const snippet = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];
      return snippet;
    case "numbers":
      if (typeof wordCount === "number") {
        return generateNumberText(wordCount);
      }
      return generateNumberText(30);
    default:
      sourceWords = [...commonWords];
  }
  
  // For common words, generate random sequence
  const result: string[] = [];
  const limit = wordCount === "infinite" ? 100 : wordCount; // Cap infinite at 100 for performance
  
  for (let i = 0; i < limit; i++) {
    let word = sourceWords[Math.floor(Math.random() * sourceWords.length)];
    
    if (includeNumbers && Math.random() < 0.1) {
      word = Math.floor(Math.random() * 1000).toString();
    }
    
    if (includePunctuation && Math.random() < 0.15) {
      const punctuation = [".", ",", "!", "?", ";", ":"][Math.floor(Math.random() * 6)];
      word = word + punctuation;
    }
    
    result.push(word);
  }
  
  return result.join(" ");
}

function generateNumberText(count: number): string {
  const numbers: string[] = [];
  for (let i = 0; i < count; i++) {
    numbers.push(Math.floor(Math.random() * 10000).toString());
  }
  return numbers.join(" ");
}

// Generate additional text for infinite mode (appends more content based on mode)
export function generateAdditionalText(config: TypingConfig, currentWordCount: number, additionalWords: number = 30): string {
  const { mode } = config;
  
  if (mode === "random") {
    const entry = encyclopediaContent[Math.floor(Math.random() * encyclopediaContent.length)];
    const words = entry.split(" ");
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, additionalWords).join(" ");
  }
  
  if (mode === "quote") {
    let result: string[] = [];
    while (result.length < additionalWords) {
      const quote = famousQuotes[Math.floor(Math.random() * famousQuotes.length)];
      const words = quote.split(" ");
      result = [...result, ...words];
    }
    return result.slice(0, additionalWords).join(" ");
  }
  
  if (mode === "normal") {
    let result: string[] = [];
    while (result.length < additionalWords) {
      const statement = factualStatements[Math.floor(Math.random() * factualStatements.length)];
      const words = statement.split(" ");
      result = [...result, ...words];
    }
    return result.slice(0, additionalWords).join(" ");
  }
  
  if (mode === "drill") {
    // Drill mode: should be handled by the TypingTest component
    return commonWords.slice(0, additionalWords).join(" ");
  }
  
  if (mode === "free") {
    // Free mode: no additional text needed
    return "";
  }
  
  // Fallback for legacy modes
  return commonWords.slice(0, additionalWords).join(" ");
}

// Word count options for the typing test
export const wordCountOptions = [100] as const;
