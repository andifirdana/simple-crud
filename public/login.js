const loginForm =
  document.getElementById(
    "loginForm"
  );

const loginError =
  document.getElementById(
    "loginError"
  );

const loginButton =
  document.getElementById(
    "loginButton"
  );


// ======================================================
// CEK SUDAH LOGIN
// ======================================================

async function cekLogin() {

  try {

    const response =
      await fetch(
        "/api/me",
        {
          credentials: "same-origin"
        }
      );

    if (response.ok) {

      window.location.replace(
        "/dashboard.html"
      );

    }

  } catch (error) {

    console.error(
      "ERROR CEK LOGIN:",
      error
    );

  }

}


cekLogin();


// ======================================================
// LOGIN
// ======================================================

loginForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    loginError.style.display =
      "none";

    loginButton.disabled =
      true;

    loginButton.textContent =
      "Memproses...";


    const email =
      document.getElementById(
        "email"
      ).value.trim();


    const password =
      document.getElementById(
        "password"
      ).value;


    try {

      const response =
        await fetch(
          "/api/login",
          {

            method: "POST",

            credentials:
              "same-origin",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({
                email,
                password
              })

          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Login gagal"
        );

      }


      console.log(
        "LOGIN BERHASIL:",
        result
      );


      window.location.replace(
        result.redirect ||
        "/dashboard.html"
      );


    } catch (error) {

      console.error(
        "ERROR LOGIN:",
        error
      );


      loginError.textContent =
        error.message;


      loginError.style.display =
        "block";


    } finally {

      loginButton.disabled =
        false;


      loginButton.textContent =
        "Masuk";

    }

  }
);