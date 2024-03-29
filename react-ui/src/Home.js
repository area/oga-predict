import React from 'react';
import cover from './cover.jpg';
import {
  Link
} from "react-router-dom";


function Home() {
  return  (
    <div class="p-5 mb-4 bg-dark rounded-3">
      <div class="container-fluid py-5">
        <h1 class="display-5 fw-bold pb-5">OGA Prediction League</h1>
      <div class="row">
        <div class="col-8 fs-4 text-start">
          <p>Do you think Matt and Hunter have no original opinions, and that you know everything about every videogame ever?</p> 
          <p>This is your chance to prove it.</p>
          <p className="fs-6"><i>This site isn't made by them. If you want to complain about the site, direct your ire at <Link to="/about">me</Link>.</i></p>
        </div>
        <div class="col-4"><img width="100%" src={cover} alt="Cover" /></div>
      </div>
      </div>
    </div>
)}
export default Home;