function createPagination({
  containerId,
  currentPage,
  totalItems,
  itemsPerPage = 10,
  onPageChange
}) {

  const container =
    document.getElementById(
      containerId
    );

  if (!container) return;


  const totalPages =
    Math.ceil(
      totalItems / itemsPerPage
    );


  container.innerHTML = "";


  if (totalPages <= 1) {
    return;
  }


  // PREVIOUS
  const prevButton =
    document.createElement("button");

  prevButton.type = "button";
  prevButton.textContent = "Previous";

  prevButton.disabled =
    currentPage === 1;

  prevButton.onclick = () => {

    if (currentPage > 1) {
      onPageChange(
        currentPage - 1
      );
    }

  };


  // CURRENT PAGE
  const pageButton =
    document.createElement("button");

  pageButton.type = "button";

  pageButton.textContent =
    currentPage;

  pageButton.classList.add(
    "active"
  );


  // NEXT
  const nextButton =
    document.createElement("button");

  nextButton.type = "button";
  nextButton.textContent = "Next";

  nextButton.disabled =
    currentPage >= totalPages;

  nextButton.onclick = () => {

    if (
      currentPage <
      totalPages
    ) {

      onPageChange(
        currentPage + 1
      );

    }

  };


  container.append(
    prevButton,
    pageButton,
    nextButton
  );

}