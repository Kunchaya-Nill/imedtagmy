document.addEventListener("DOMContentLoaded", function () {
    const recoveryForm = document.querySelector("form");

    recoveryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value;

        try {
            const response = await fetch("http://localhost:5000/api/recover-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            // ⚠️ If response is not JSON, throw an error
            if (!response.ok) {
                const text = await response.text(); // Get response as text
                throw new Error(`Error: ${response.status} - ${text}`);
            }

            const data = await response.json();
            alert("Password reset link sent! Check your email.");
            recoveryForm.reset();
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong: " + error.message);
        }
    });
});
