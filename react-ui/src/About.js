import React from 'react';

function Users() {
  return ( <React.Fragment><h1 class="text-center">About</h1>
      <h2 class="mt-5">What is this?</h2>
      <p class="fs-5 mb-5">As new episodes of the <a href="https://oldgamersalmanac.podbean.com/">Old Gamer's Almanac</a> came out, when I saw the episode name I'd guess where in the list the game would be put. Going against the primary request that's made every week on the podcast, I thought that maybe a game could be made out of it...</p>
      <h2>Can anyone play?</h2>
      <p class="fs-5 mb-5">Yep, just log in with Discord (hit the link in the top right), and you'll be able to predict if the next game is known.</p>
      <h2>Talk maths to me.</h2>
      <p class="fs-5">In order to (try and) not advantage people who start playing earlier, the score you have is a normalised Root Mean Square of the errors in your predictions.</p>
      <p class="fs-5">For each game that you gave a prediction for, the difference between your prediction and the rank the game entered the list at is taken and divided by the size of the list at that time. You can think of this as your fractional error in the prediction. This is comparable between games that entered with different list sizes (e.g. if you were one place off when the list was 10 long, that's the same as being two places off when the list is 20 long).</p>
      <p class="fs-5">The root mean square of these difference is calculated, and then that's scaled to what it would be with the list at its current size.</p>
      <p class="fs-5 mb-5">This means it's like playing golf, and a smaller score is better! The best possible score is 0.</p>
      <h2>Why does this look like garbage?</h2>
      <p class="fs-5 mb-5">I am very much a back-end developer, not a front-end developer. I tried my best, but if you fancy turning this lump of coal in to a sparkling diamond, feel free to reach out to me (area#2758) in the Old Gamer's Almanac section of the <a href="https://spacecatspeaceturtles.com/community/community/">SCPT Discord</a>. Or even better, make an issue or a pull request over at <a href="https://github.com/area/oga-predict">Github</a>.</p>
  </React.Fragment>
  )
}

export default Users;