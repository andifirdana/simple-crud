const bcrypt =
  require("bcrypt");


async function buatPassword() {

  const password =
    "Novica19";


  const hash =
    await bcrypt.hash(
      password,
      12
    );


  console.log(hash);

}


buatPassword();