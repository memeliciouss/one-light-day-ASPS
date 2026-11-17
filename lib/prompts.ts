export const prompts = [
  { id: 'message', number: '01', title: 'A message across the cosmos', short: 'What would you tell Voyager?', question: 'If you could send one last message from Earth to Voyager 1, knowing it might travel for millions of years, what would you say?' },
  { id: 'sound', number: '02', title: 'The sound of humanity', short: 'What should Earth sound like?', question: 'If you could send one sound, song or piece of music from Earth to an extraterrestrial civilisation, what would it be?' },
  { id: 'portrait', number: '03', title: 'A portrait of Earth', short: 'One image to represent our planet.', question: 'If you could show another civilisation just one image to explain Earth, what would you choose?' },
  { id: 'human', number: '04', title: 'What makes us human?', short: 'One thing they should understand.', question: 'What is one thing about humanity that you would want another civilisation to understand about us?' },
  { id: 'future', number: '05', title: 'A message to the unknown', short: 'A note for whoever finds us.', question: 'Imagine someone discovers your Golden Record a million years from now. What would you want them to know about the civilisation that sent it?' }
] as const;
export type PromptId = typeof prompts[number]['id'];
export type Contribution = { id: string; name: string; prompt_id: string; message: string; created_at: string };
