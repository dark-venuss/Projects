interface QuoteData {
    id: number;
    quote: string;
    author: string;
}

const quoteText = document.getElementById('quote') as HTMLParagraphElement;
const authorText = document.getElementById('author') as HTMLSpanElement;
const newQuoteBtn = document.getElementById('new-quote-btn') as HTMLButtonElement;
const API_URL: string = 'https://dummyjson.com/quotes/random';

function getQuote(): void {
    toggleLoading(true);
    fetch(API_URL)
        .then((response) => {
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.json();
        })
        .then((data: QuoteData) => {
            displayQuote(data);
            toggleLoading(false);
        })
        .catch((error) => {
            console.error('Error fetching quote:', error);
            quoteText.innerText = "Oops! Something went wrong. Try again.";
            authorText.innerText = "";
            toggleLoading(false);
        });
}

function displayQuote(data: QuoteData): void {
    quoteText.innerText = '"' + data.quote + '"';
    authorText.innerText = '- ' + data.author;
}

function toggleLoading(isLoading: boolean): void {
    if (isLoading) {
        newQuoteBtn.disabled = true;
        newQuoteBtn.innerText = "Loading...";
        quoteText.style.opacity = "0.7";
    } else {
        newQuoteBtn.disabled = false;
        newQuoteBtn.innerText = "Get New Quote";
        quoteText.style.opacity = "1";
    }
}

window.addEventListener('DOMContentLoaded', () => {
    getQuote();
});

newQuoteBtn.addEventListener('click', () => {
    getQuote();
});