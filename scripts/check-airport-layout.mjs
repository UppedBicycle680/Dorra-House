process.env.DORRA_QA_MODE='layout';
process.env.DORRA_QA_OUTPUT ||= 'work/airport-layout';
await import('../airport-browser-operations-regression.mjs');
