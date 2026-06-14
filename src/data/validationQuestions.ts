// ── MaglakbAI validation question bank ───────────────────────────────────────
// 10 multiple-choice questions per skill for the "Prove you know it" knowledge
// challenge. Each question cites a verified, reliable source (official docs,
// standards bodies, or established references). Merged into ALL_SKILLS by id in
// src/data/skills.ts, so adding a skill here gives it a 10-question validation.
//
// Pass bar: 7 of 10 (70%, computed in ValidationChallengeModal). Reward: +100 XP
// + the Validated badge (validateSkill in coreSlice).
//
// Authored path-by-path. Skills not yet present here fall back to any inline
// questions defined on the skill in skills.ts.

import type { ValidationQuestion } from '../types';

export const VALIDATION_QUESTIONS: Record<string, ValidationQuestion[]> = {
  // ─────────────────────────────────────────────────────────────────────────
  // DATA ARCHITECT
  // ─────────────────────────────────────────────────────────────────────────

  'sql-foundations': [
    {
      prompt: 'Which SQL clause filters rows AFTER aggregation (e.g. on a SUM or COUNT)?',
      choices: ['WHERE', 'HAVING', 'ORDER BY', 'DISTINCT'],
      correctIndex: 1,
      explanation: 'WHERE filters individual rows before grouping; HAVING filters groups after aggregation, e.g. HAVING SUM(sales) > 1000.',
      source: 'PostgreSQL Documentation — SELECT / HAVING (postgresql.org/docs)',
    },
    {
      prompt: 'In a query with GROUP BY, which columns may appear in SELECT without being inside an aggregate function?',
      choices: [
        'Any column in the table',
        'Only columns listed in the GROUP BY clause',
        'Only the primary key',
        'No columns — everything must be aggregated',
      ],
      correctIndex: 1,
      explanation: 'Non-aggregated columns in SELECT must appear in GROUP BY; otherwise the value would be ambiguous within a group.',
      source: 'PostgreSQL Documentation — GROUP BY (postgresql.org/docs)',
    },
    {
      prompt: 'What is the correct way to test a column for NULL?',
      choices: ['col = NULL', 'col == NULL', 'col IS NULL', 'col EQUALS NULL'],
      correctIndex: 2,
      explanation: 'NULL is unknown, so any comparison with = yields NULL (not true). Use IS NULL / IS NOT NULL.',
      source: 'ISO/IEC SQL standard; PostgreSQL Documentation — Comparison Operators',
    },
    {
      prompt: 'A LEFT JOIN between A and B returns:',
      choices: [
        'Only rows with a match in both A and B',
        'All rows from A, with NULLs where B has no match',
        'All rows from B, with NULLs where A has no match',
        'Every combination of rows from A and B',
      ],
      correctIndex: 1,
      explanation: 'LEFT (OUTER) JOIN keeps all left-table rows; unmatched right-table columns are NULL. INNER JOIN keeps only matches.',
      source: 'PostgreSQL Documentation — Joined Tables (postgresql.org/docs)',
    },
    {
      prompt: 'How does RANK() differ from DENSE_RANK() when there are ties?',
      choices: [
        'RANK() skips numbers after ties (1,1,3); DENSE_RANK() does not (1,1,2)',
        'They are identical',
        'DENSE_RANK() skips after ties; RANK() does not',
        'RANK() only works without ORDER BY',
      ],
      correctIndex: 0,
      explanation: 'RANK() leaves gaps after ties (1,1,3,4); DENSE_RANK() does not (1,1,2,3).',
      source: 'PostgreSQL Documentation — Window Functions (postgresql.org/docs)',
    },
    {
      prompt: 'A Common Table Expression (CTE / WITH clause) is best described as:',
      choices: [
        'A permanent table written to disk',
        'A reusable named result set defined for a single query',
        'A way to encrypt query output',
        'An index type for large tables',
      ],
      correctIndex: 1,
      explanation: 'A CTE defines a named, temporary result set used within the same statement — cleaner than nested subqueries and not persisted.',
      source: 'PostgreSQL Documentation — WITH Queries (postgresql.org/docs)',
    },
    {
      prompt: 'What is the difference between COUNT(*) and COUNT(column)?',
      choices: [
        'They are always equal',
        'COUNT(*) counts all rows; COUNT(column) ignores NULLs in that column',
        'COUNT(column) is faster and counts NULLs too',
        'COUNT(*) ignores NULLs; COUNT(column) counts them',
      ],
      correctIndex: 1,
      explanation: 'COUNT(*) counts every row; COUNT(column) counts only rows where that column is non-NULL.',
      source: 'PostgreSQL Documentation — Aggregate Functions (postgresql.org/docs)',
    },
    {
      prompt: 'UNION vs UNION ALL — what is the key difference?',
      choices: [
        'UNION ALL removes duplicate rows; UNION keeps them',
        'UNION removes duplicate rows; UNION ALL keeps all rows',
        'They are identical in result',
        'UNION only works on a single table',
      ],
      correctIndex: 1,
      explanation: 'UNION removes duplicates (an implicit DISTINCT, which costs a sort/hash); UNION ALL returns everything and is faster.',
      source: 'PostgreSQL Documentation — Combining Queries (postgresql.org/docs)',
    },
    {
      prompt: 'In which logical order are these clauses processed?',
      choices: [
        'SELECT → FROM → WHERE → GROUP BY → ORDER BY',
        'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY',
        'WHERE → FROM → SELECT → GROUP BY → ORDER BY',
        'FROM → SELECT → WHERE → ORDER BY → GROUP BY',
      ],
      correctIndex: 1,
      explanation: 'Logical processing is FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. This is why SELECT aliases can be used in ORDER BY but not WHERE.',
      source: 'Microsoft SQL Docs — Logical Query Processing; SQL standard',
    },
    {
      prompt: 'What is the primary trade-off of adding an index to a column?',
      choices: [
        'Faster reads/lookups, but slower writes and extra storage',
        'Faster writes, but slower reads',
        'No trade-off — indexes are always free',
        'It encrypts the column',
      ],
      correctIndex: 0,
      explanation: 'Indexes (commonly B-trees) speed up SELECT/lookups and ORDER BY, but each INSERT/UPDATE/DELETE must also maintain the index, and it consumes storage.',
      source: 'PostgreSQL Documentation — Indexes (postgresql.org/docs)',
    },
  ],

  'python-automation': [
    {
      prompt: 'When loading a CSV with pandas via pd.read_csv(), what object is returned?',
      choices: ['A list of lists', 'A DataFrame', 'A NumPy array', 'A dictionary'],
      correctIndex: 1,
      explanation: 'pd.read_csv() returns a pandas DataFrame — a 2D labeled, tabular structure.',
      source: 'pandas Documentation — pandas.read_csv (pandas.pydata.org/docs)',
    },
    {
      prompt: 'Why use a "with open(path) as f:" context manager to read a file?',
      choices: [
        'It makes the file load faster',
        'It guarantees the file is closed even if an error occurs',
        'It is the only way to open a file',
        'It encrypts the file contents',
      ],
      correctIndex: 1,
      explanation: 'The with-statement (context manager) automatically closes the file when the block exits, even on exception — preventing resource leaks.',
      source: 'Python Documentation — Reading and Writing Files (docs.python.org/3)',
    },
    {
      prompt: 'Which Python data structure is immutable?',
      choices: ['list', 'dict', 'set', 'tuple'],
      correctIndex: 3,
      explanation: 'Tuples are immutable (cannot be changed after creation); lists, dicts, and sets are mutable.',
      source: 'Python Documentation — Data Structures (docs.python.org/3)',
    },
    {
      prompt: 'What does dict.get("key") return if the key is missing?',
      choices: [
        'It raises a KeyError',
        'None (or a supplied default)',
        'An empty string',
        'It creates the key with value 0',
      ],
      correctIndex: 1,
      explanation: 'dict.get(key) returns None when the key is absent (or the second argument if provided), avoiding the KeyError that d[key] would raise.',
      source: 'Python Documentation — Mapping Types dict (docs.python.org/3)',
    },
    {
      prompt: 'What is the purpose of a virtual environment (venv)?',
      choices: [
        'To run Python faster',
        'To isolate a project’s dependencies from other projects and the system Python',
        'To compile Python to machine code',
        'To encrypt source files',
      ],
      correctIndex: 1,
      explanation: 'A venv gives each project its own isolated set of installed packages, avoiding version conflicts between projects.',
      source: 'Python Documentation — venv (docs.python.org/3/library/venv.html)',
    },
    {
      prompt: 'In the requests library, how do you check whether an HTTP call succeeded?',
      choices: [
        'Inspect response.status_code (e.g. 200) or call response.raise_for_status()',
        'There is no way to tell',
        'Check response.length',
        'Read response.error only',
      ],
      correctIndex: 0,
      explanation: 'response.status_code holds the HTTP status (200 = OK); raise_for_status() throws on 4xx/5xx so failures are not silently ignored.',
      source: 'Requests Documentation — Quickstart (requests.readthedocs.io)',
    },
    {
      prompt: 'What does the "if __name__ == \'__main__\':" guard do?',
      choices: [
        'Marks the file as the main package',
        'Runs the block only when the file is executed directly, not when imported',
        'Speeds up imports',
        'Declares a global variable',
      ],
      correctIndex: 1,
      explanation: 'When a module is imported, __name__ is the module name; when run directly it is "__main__". The guard lets a file act as both a reusable module and a script.',
      source: 'Python Documentation — __main__ (docs.python.org/3/library/__main__.html)',
    },
    {
      prompt: 'Which construct handles a runtime error so a pipeline can continue or fail gracefully?',
      choices: ['if/else', 'try/except', 'for/while', 'with/as'],
      correctIndex: 1,
      explanation: 'try/except catches exceptions raised at runtime, letting you log, retry, or clean up instead of crashing.',
      source: 'Python Documentation — Errors and Exceptions (docs.python.org/3)',
    },
    {
      prompt: 'In pandas, how do you combine two DataFrames on a shared key column (SQL-style join)?',
      choices: ['df.concat()', 'df.merge()', 'df.append()', 'df.zip()'],
      correctIndex: 1,
      explanation: 'DataFrame.merge() performs database-style joins (inner/left/right/outer) on key columns; concat stacks frames along an axis.',
      source: 'pandas Documentation — DataFrame.merge (pandas.pydata.org/docs)',
    },
    {
      prompt: 'What is an f-string in Python (e.g. f"Loaded {n} rows")?',
      choices: [
        'A formatted string literal that evaluates embedded expressions inline',
        'A file-reading function',
        'A way to declare a float',
        'A regular expression',
      ],
      correctIndex: 0,
      explanation: 'f-strings (PEP 498) embed expressions inside string literals, evaluated at runtime — concise and faster than %-formatting or .format().',
      source: 'Python Documentation — Formatted string literals (docs.python.org/3)',
    },
  ],

  'snowflake-engineering': [
    {
      prompt: 'What is the defining feature of Snowflake’s architecture?',
      choices: [
        'Storage and compute are tightly coupled on each node',
        'Storage and compute are separated and scale independently',
        'It runs only on-premises',
        'It has no SQL support',
      ],
      correctIndex: 1,
      explanation: 'Snowflake separates storage from compute (virtual warehouses), so you can scale or pause compute independently of stored data.',
      source: 'Snowflake Documentation — Key Concepts & Architecture (docs.snowflake.com)',
    },
    {
      prompt: 'In Snowflake, a "virtual warehouse" provides:',
      choices: ['Persistent table storage', 'Compute resources for queries and loading', 'User authentication', 'Network routing'],
      correctIndex: 1,
      explanation: 'A virtual warehouse is a cluster of compute that executes queries and DML; it can be resized, auto-suspended, and auto-resumed.',
      source: 'Snowflake Documentation — Virtual Warehouses (docs.snowflake.com)',
    },
    {
      prompt: 'Snowflake automatically divides table data into:',
      choices: ['User-defined partitions', 'Micro-partitions managed by Snowflake', 'Manual shards', 'Fixed 1 GB blocks'],
      correctIndex: 1,
      explanation: 'Snowflake stores data in compressed, columnar micro-partitions (~50–500 MB of uncompressed data each) created and managed automatically.',
      source: 'Snowflake Documentation — Micro-partitions & Data Clustering (docs.snowflake.com)',
    },
    {
      prompt: 'What does Snowflake Time Travel let you do?',
      choices: [
        'Query or restore data as it existed at an earlier point in time',
        'Schedule queries for the future',
        'Speed up running queries',
        'Migrate to another cloud',
      ],
      correctIndex: 0,
      explanation: 'Time Travel lets you query, clone, or restore historical data within the retention window (default 1 day, up to 90 on Enterprise).',
      source: 'Snowflake Documentation — Time Travel (docs.snowflake.com)',
    },
    {
      prompt: 'Which data type stores semi-structured data such as JSON in Snowflake?',
      choices: ['STRING', 'VARIANT', 'NUMBER', 'BLOB'],
      correctIndex: 1,
      explanation: 'VARIANT (along with OBJECT and ARRAY) stores semi-structured data like JSON, Avro, or Parquet, queryable with path notation.',
      source: 'Snowflake Documentation — Semi-structured Data Types (docs.snowflake.com)',
    },
    {
      prompt: 'Zero-copy cloning in Snowflake creates a copy of a table that:',
      choices: [
        'Duplicates all underlying storage immediately',
        'Shares existing micro-partitions until data changes (no extra storage at first)',
        'Is read-only forever',
        'Deletes the original',
      ],
      correctIndex: 1,
      explanation: 'CLONE creates a new object referencing the same micro-partitions; storage is only consumed for subsequent changes (copy-on-write).',
      source: 'Snowflake Documentation — CREATE ... CLONE (docs.snowflake.com)',
    },
    {
      prompt: 'How is the cost of a Snowflake virtual warehouse primarily controlled when idle?',
      choices: [
        'It cannot be controlled',
        'Auto-suspend stops the warehouse after a period of inactivity',
        'You must drop and recreate it',
        'By deleting the database',
      ],
      correctIndex: 1,
      explanation: 'Compute is billed per second while a warehouse runs; AUTO_SUSPEND pauses it after idle time and AUTO_RESUME restarts it on the next query.',
      source: 'Snowflake Documentation — Warehouse Considerations (docs.snowflake.com)',
    },
    {
      prompt: 'Which command bulk-loads staged files into a Snowflake table?',
      choices: ['INSERT ONE', 'COPY INTO <table>', 'LOAD FILE', 'IMPORT'],
      correctIndex: 1,
      explanation: 'Data is placed in a stage (internal or external) and loaded with COPY INTO <table>, which supports CSV, JSON, Parquet, and more.',
      source: 'Snowflake Documentation — COPY INTO <table> (docs.snowflake.com)',
    },
    {
      prompt: 'What is a clustering key used for on a large Snowflake table?',
      choices: [
        'Encrypting the table',
        'Co-locating related data to improve partition pruning and query performance',
        'Defining primary keys',
        'Limiting the number of rows',
      ],
      correctIndex: 1,
      explanation: 'A clustering key reorganizes micro-partitions so queries that filter on it scan fewer partitions (better pruning) on very large tables.',
      source: 'Snowflake Documentation — Clustering Keys & Clustered Tables (docs.snowflake.com)',
    },
    {
      prompt: 'Snowflake can return some query results instantly without using a warehouse because of:',
      choices: ['The result cache', 'A faster CPU', 'Manual indexing', 'Replication'],
      correctIndex: 0,
      explanation: 'Snowflake caches query results for 24 hours; an identical query on unchanged data is served from the result cache with no compute cost.',
      source: 'Snowflake Documentation — Using Persisted Query Results (docs.snowflake.com)',
    },
  ],

  'data-modeling': [
    {
      prompt: 'A star schema is composed of:',
      choices: [
        'Many-to-many bridge tables only',
        'A central fact table linked to surrounding dimension tables',
        'A single flat table',
        'Only normalized lookup tables',
      ],
      correctIndex: 1,
      explanation: 'A star schema has a central fact table (measures) joined to denormalized dimension tables (descriptive context) — the foundation of dimensional modeling.',
      source: 'Kimball Group — Dimensional Modeling Techniques (kimballgroup.com)',
    },
    {
      prompt: 'A fact table primarily stores:',
      choices: [
        'Descriptive attributes like names and categories',
        'Numeric, additive measures at a defined grain, plus foreign keys to dimensions',
        'Only primary keys',
        'Application source code',
      ],
      correctIndex: 1,
      explanation: 'Facts hold measurements (e.g. sales amount, quantity) at a stated grain and reference dimensions via foreign keys.',
      source: 'Kimball Group — Fact Tables (kimballgroup.com)',
    },
    {
      prompt: 'What does the "grain" of a fact table define?',
      choices: [
        'Its storage format',
        'The level of detail represented by one row',
        'The number of dimensions',
        'The encryption level',
      ],
      correctIndex: 1,
      explanation: 'Grain = what a single fact row means (e.g. "one row per order line per day"). Declaring the grain first is a core dimensional-modeling step.',
      source: 'Kimball Group — Declare the Grain (kimballgroup.com)',
    },
    {
      prompt: 'Third Normal Form (3NF) primarily eliminates:',
      choices: [
        'All foreign keys',
        'Transitive dependencies (non-key attributes depending on other non-key attributes)',
        'Primary keys',
        'Indexes',
      ],
      correctIndex: 1,
      explanation: '3NF requires that non-key columns depend only on the key — removing transitive dependencies and reducing update anomalies.',
      source: 'Codd / relational normalization; standard database design references',
    },
    {
      prompt: 'A Slowly Changing Dimension Type 2 (SCD2) handles a changed attribute by:',
      choices: [
        'Overwriting the old value in place',
        'Adding a new row that preserves history (with effective dates / version flags)',
        'Deleting the dimension',
        'Ignoring the change',
      ],
      correctIndex: 1,
      explanation: 'SCD Type 2 inserts a new dimension row to retain history; Type 1 simply overwrites (no history).',
      source: 'Kimball Group — Slowly Changing Dimensions (kimballgroup.com)',
    },
    {
      prompt: 'A foreign key enforces:',
      choices: [
        'Column encryption',
        'Referential integrity — values must match a key in the referenced table',
        'Uniqueness of every row',
        'Automatic indexing of all columns',
      ],
      correctIndex: 1,
      explanation: 'A foreign key constrains a column to values that exist in the referenced table’s key, preventing orphaned records.',
      source: 'PostgreSQL Documentation — Constraints / Foreign Keys (postgresql.org/docs)',
    },
    {
      prompt: 'What distinguishes a snowflake schema from a star schema?',
      choices: [
        'It has no fact table',
        'Its dimension tables are normalized into multiple related tables',
        'It cannot be queried with SQL',
        'It stores only JSON',
      ],
      correctIndex: 1,
      explanation: 'A snowflake schema normalizes dimensions into sub-tables (saving space, more joins); a star schema keeps dimensions denormalized (fewer joins, simpler queries).',
      source: 'Kimball Group — Dimensional Modeling Techniques (kimballgroup.com)',
    },
    {
      prompt: 'A surrogate key is:',
      choices: [
        'A natural business identifier like an email address',
        'A system-generated, meaningless key (e.g. an integer) used as the primary key',
        'A foreign key to another database',
        'An encrypted password',
      ],
      correctIndex: 1,
      explanation: 'Surrogate keys are synthetic identifiers independent of business meaning — stable across source-system changes and ideal for dimension keys.',
      source: 'Kimball Group — Surrogate Keys (kimballgroup.com)',
    },
    {
      prompt: 'Denormalization is typically done to:',
      choices: [
        'Improve read/query performance at the cost of redundancy',
        'Always save storage space',
        'Remove all relationships',
        'Guarantee zero data duplication',
      ],
      correctIndex: 0,
      explanation: 'Denormalization duplicates/combines data to reduce joins and speed up reads (common in analytics/dimensional models), trading off some redundancy and update complexity.',
      source: 'Kimball Group; standard data-warehouse design references',
    },
    {
      prompt: 'A primary key guarantees that:',
      choices: [
        'The column can contain NULLs',
        'Each row is uniquely identifiable and the key is non-NULL',
        'Values are encrypted',
        'The table is sorted by that column',
      ],
      correctIndex: 1,
      explanation: 'A primary key uniquely identifies each row and cannot be NULL; a table has at most one primary key.',
      source: 'PostgreSQL Documentation — Primary Keys (postgresql.org/docs)',
    },
  ],

  'ai-workflow-design': [
    {
      prompt: 'What does RAG (Retrieval-Augmented Generation) do?',
      choices: [
        'Trains a model from scratch',
        'Retrieves relevant external data and supplies it to the model as context at query time',
        'Compresses the model weights',
        'Encrypts prompts',
      ],
      correctIndex: 1,
      explanation: 'RAG fetches relevant documents (often from a vector store) and injects them into the prompt so the model can answer with up-to-date, grounded information.',
      source: 'AWS — What is Retrieval-Augmented Generation? (aws.amazon.com/what-is/retrieval-augmented-generation)',
    },
    {
      prompt: 'In an AI workflow, an embedding is:',
      choices: [
        'A numeric vector representing the meaning of text so similar items are close in vector space',
        'A compressed image',
        'A SQL index',
        'A type of API key',
      ],
      correctIndex: 0,
      explanation: 'Embeddings map text (or other data) to dense vectors; semantically similar inputs have nearby vectors, enabling similarity search.',
      source: 'OpenAI Documentation — Embeddings (platform.openai.com/docs)',
    },
    {
      prompt: 'What is a vector database primarily used for in a RAG pipeline?',
      choices: [
        'Storing relational rows',
        'Fast similarity search over embedding vectors (nearest-neighbor retrieval)',
        'Hosting the LLM',
        'Rendering the UI',
      ],
      correctIndex: 1,
      explanation: 'Vector databases index embeddings and perform approximate nearest-neighbor search to retrieve the most relevant chunks for a query.',
      source: 'Pinecone Documentation — What is a Vector Database? (docs.pinecone.io)',
    },
    {
      prompt: 'Why are large documents "chunked" before being embedded for retrieval?',
      choices: [
        'To delete redundant text',
        'So retrieval returns focused, relevant passages that fit the model’s context window',
        'To encrypt them',
        'Chunking is never recommended',
      ],
      correctIndex: 1,
      explanation: 'Splitting documents into smaller chunks improves retrieval precision and keeps retrieved context within the model’s token limit.',
      source: 'LangChain Documentation — Text Splitters / Retrieval (python.langchain.com)',
    },
    {
      prompt: 'A model’s "temperature" parameter controls:',
      choices: [
        'The hardware speed',
        'The randomness/creativity of the output (higher = more varied)',
        'The maximum tokens',
        'The cost per call',
      ],
      correctIndex: 1,
      explanation: 'Lower temperature makes outputs more deterministic/focused; higher temperature increases diversity and creativity.',
      source: 'OpenAI Documentation — API Reference, temperature (platform.openai.com/docs)',
    },
    {
      prompt: 'What does "few-shot prompting" mean?',
      choices: [
        'Asking the model only one short question',
        'Including a few worked examples in the prompt to guide the desired output format',
        'Fine-tuning on millions of rows',
        'Limiting the response length',
      ],
      correctIndex: 1,
      explanation: 'Few-shot prompting provides example input/output pairs in the prompt so the model infers the pattern — versus zero-shot (no examples).',
      source: 'Anthropic Documentation — Prompt engineering / multishot (docs.anthropic.com)',
    },
    {
      prompt: 'In LLMs, a "token" is:',
      choices: [
        'A security credential',
        'A unit of text (roughly a word piece) that the model reads and generates',
        'One full sentence',
        'A database row',
      ],
      correctIndex: 1,
      explanation: 'Models process text as tokens (sub-word units); context windows and pricing are measured in tokens.',
      source: 'OpenAI Documentation — Tokens / Tokenizer (platform.openai.com/docs)',
    },
    {
      prompt: 'A "hallucination" in an LLM refers to:',
      choices: [
        'A network error',
        'The model producing fluent but factually wrong or fabricated information',
        'A slow response',
        'An image-generation feature',
      ],
      correctIndex: 1,
      explanation: 'Hallucination is confident but incorrect/unsupported output; grounding techniques like RAG and citations help reduce it.',
      source: 'Google Cloud — What are AI hallucinations? (cloud.google.com)',
    },
    {
      prompt: 'When should you prefer RAG over fine-tuning?',
      choices: [
        'When you need the model to use frequently-changing or proprietary knowledge without retraining',
        'When you never want to update knowledge',
        'When you want to change the model’s writing style only',
        'RAG and fine-tuning are identical',
      ],
      correctIndex: 0,
      explanation: 'RAG injects current/proprietary facts at query time (easy to update); fine-tuning bakes in behavior/style and is better for format/tone than for fast-changing facts.',
      source: 'AWS — RAG vs fine-tuning (aws.amazon.com/what-is/retrieval-augmented-generation)',
    },
    {
      prompt: 'What is the role of a system prompt?',
      choices: [
        'It logs errors',
        'It sets the model’s persona, rules, and task context before the user’s messages',
        'It stores the API key',
        'It defines the database schema',
      ],
      correctIndex: 1,
      explanation: 'The system prompt establishes high-level instructions, role, and constraints that shape how the model responds to subsequent user input.',
      source: 'Anthropic Documentation — System prompts (docs.anthropic.com)',
    },
  ],
};
