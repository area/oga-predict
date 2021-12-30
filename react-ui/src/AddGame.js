import React from 'react';
import GameForm from './GameForm';

const AddGame = () => {
  const handleOnSubmit = (game) => {
      fetch("/api/games", {
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
      <GameForm handleOnSubmit={handleOnSubmit} />
    </React.Fragment>
  );
};

export default AddGame;