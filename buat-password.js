const bcrypt =
  require("bcrypt");


async function buatPassword() {

  const password =
    "Password123!";


  const hash =
    await bcrypt.hash(
      password,
      12
    );


  console.log(hash);

}


buatPassword();