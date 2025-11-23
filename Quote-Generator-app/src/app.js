var quoteText = document.getElementById('quote');
var authorText = document.getElementById('author');
var newQuoteBtn = document.getElementById('new-quote-btn');
var API_URL = 'https://dummyjson.com/quotes/random';
function getQuote() {
    toggleLoading(true);
    fetch(API_URL)
        .then(function (response) {
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        return response.json();
    })
        .then(function (data) {
        displayQuote(data);
        toggleLoading(false);
    })
        .catch(function (error) {
        console.error('Error fetching quote:', error);
        quoteText.innerText = "Oops! Something went wrong. Try again.";
        authorText.innerText = "";
        toggleLoading(false);
    });
}
function displayQuote(data) {
    quoteText.innerText = '"' + data.quote + '"';
    authorText.innerText = '- ' + data.author;
}
function toggleLoading(isLoading) {
    if (isLoading) {
        newQuoteBtn.disabled = true;
        newQuoteBtn.innerText = "Loading...";
        quoteText.style.opacity = "0.7";
    }
    else {
        newQuoteBtn.disabled = false;
        newQuoteBtn.innerText = "Get New Quote";
        quoteText.style.opacity = "1";
    }
}
window.addEventListener('DOMContentLoaded', function () {
    getQuote();
});
newQuoteBtn.addEventListener('click', function () {
    getQuote();
});
