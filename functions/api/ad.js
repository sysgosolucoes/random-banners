export async function onRequest(context) {
    const { request } = context;

    const baseUrl = new URL(request.url).origin;

    const ads = [
        {
            image: `${baseUrl}/images/imagem1.jpg`,
            url: "https://cliente1.com"
        },
        {
            image: `${baseUrl}/images/imagem2.jpg`,
            url: "https://cliente2.com"
        }
    ];

    const randomIndex = Math.floor(Math.random() * ads.length);
    const selected = ads[randomIndex];

    return new Response(JSON.stringify(selected), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}
