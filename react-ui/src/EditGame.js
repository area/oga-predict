import React, { useCallback, useEffect, useState, useMemo } from 'react';
import GameForm from './GameForm';
import { useParams } from 'react-router-dom';
const EditGame = () => {

  const { id } = useParams();

  const [game, setGame] = useState({});


  const fetchData = useCallback(() => {
    fetch("/api/games/" + id)
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        console.log(json)
        setGame(json)
      }).catch(e => {
        console.log(e);
      })
  });

  useEffect(() => {
    fetchData();
  }, []);


  const handleOnSubmit = (game) => {
    console.log(JSON.stringify({...game}))
      fetch(`/api/games/${id}`, {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({...game})
        });
  };

  return (
    <React.Fragment>
      <GameForm handleOnSubmit={handleOnSubmit} game={game} />
    </React.Fragment>
  );
};

export default EditGame;