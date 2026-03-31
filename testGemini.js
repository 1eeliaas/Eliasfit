
const key = 'AIzaSyD1gxJzI5nj9MYY_SzdKUolI0Aa9qIIaRE';

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{
            parts: [{ text: `Tu es un expert en nutrition. Analyse le repas suivant : "1 banane". Génère une réponse UNIQUEMENT au format JSON strict (pas de markdown \`\`\`json). Le JSON doit contenir : {"calories": entier_kcal, "protein": entier_grammes, "carbs": entier_grammes, "fat": entier_grammes, "quantity": "chaine_courte_ex_250g", "summary": "resume_tres_court_du_repas", "emoji": "un_seul_emoji_representatif", "image_prompt": "two_or_three_english_keywords_for_food_photography"}` }]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    })
})
.then(r => r.json())
.then(j => {
    console.log(JSON.stringify(j, null, 2));
})
.catch(console.error);
