const passwordBox = document.getElementById("password");
const lenght = 12;
const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*_+?";

function generatePassword() {
  let password = "";
  for (let i = 0; i < lenght; i++) {
    const random = Math.floor(Math.random() * charset.length);
    password += charset[random];
  }
  passwordBox.value = password;
}

function copyPassword() {
  passwordBox.select();
  document.execCommand("copy");
  alert("Password copied to clipboard");
}