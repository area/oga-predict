import React, { useCallback, useEffect, useState, Container} from 'react';
import cover from './cover.jpg';

function Home() {
  const [message, setMessage] = useState(null);
  const [url] = useState('/api');
  const [isFetching, setIsFetching] = useState(false);
  const fetchData = useCallback(() => {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setMessage(json.message);
        setIsFetching(false);
      }).catch(e => {
        setMessage(`API call failed: ${e}`);
        setIsFetching(false);
      })
  }, [url]);

  useEffect(() => {
    setIsFetching(true);
    fetchData();
  }, [fetchData]);

  return  (
    <div class="p-5 mb-4 bg-dark rounded-3">
      <div class="container-fluid py-5">
        <h1 class="display-5 fw-bold pb-5">OGA Prediction League</h1>
      <div class="row">
        <div class="col-8 fs-4 text-start"><p>Do you think Matt and Hunter have no original opinions, and that you know everything about every videogame ever?</p> <p>This is your chance to prove it.</p></div>
        <div class="col-4"><img width="100%" src={cover} alt="Cover" /></div>
      </div>
      </div>
    </div>
)}
export default Home;