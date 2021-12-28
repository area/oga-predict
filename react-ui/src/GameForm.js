import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';

const GameForm = (props) => {

  const [game, setGame] = useState({
    name: "",
    rank: "",
    episode: ""
  });

  useEffect(() =>{
    setGame(props.game || {
    name: "",
    rank: "",
    episode: ""
  })
  }, [props.game])

  const [errorMsg, setErrorMsg] = useState('');
  const { name, rank, episode, igdbId } = game;

  const handleOnSubmit = (event) => {
    event.preventDefault();
    const values = [name, rank, episode, igdbId];
    let errorMsg = '';

    const allFieldsFilled = values.every((field) => {
      const value = `${field}`.trim();
      return value !== '';
    });

    if (allFieldsFilled) {
      const game = {
        name, rank, episode, igdbId
      };
      props.handleOnSubmit(game);
    } else {
      errorMsg = 'Please fill out all the fields.';
    }
    setErrorMsg(errorMsg);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    switch (name) {
      // TODO: VAlidation?
      // case 'name':
      //   if (value === '' || parseInt(value) === +value) {
      //     setGame((prevState) => ({
      //       ...prevState,
      //       [name]: value
      //     }));
      //   }
      //   break;
      default:
        setGame((prevState) => ({
          ...prevState,
          [name]: value
        }));
    }
  };

  return (
    <div className="main-form text-light">
      {errorMsg && <p className="errorMsg">{errorMsg}</p>}
      <Form onSubmit={handleOnSubmit}>
        <Form.Group controlId="name">
          <Form.Label>Game Name</Form.Label>
          <Form.Control
            className="input-control"
            type="text"
            name="name"
            value={name}
            placeholder="Name of Game"
            onChange={handleInputChange}
          />
        </Form.Group>
        <Form.Group controlId="rank">
          <Form.Label>Rank</Form.Label>
          <Form.Control
            className="input-control"
            type="number"
            name="rank"
            value={rank}
            placeholder="Enter rank when first introduced"
            onChange={handleInputChange}
          />
        </Form.Group>
        <Form.Group controlId="episode">
          <Form.Label>Episode</Form.Label>
          <Form.Control
            className="input-control"
            type="number"
            name="episode"
            value={episode}
            placeholder="Enter episode game reviewed"
            onChange={handleInputChange}
          />
        </Form.Group>
        <Form.Group controlId="igdbId">
          <Form.Label>IGDB Id</Form.Label>
          <Form.Control
            className="input-control"
            type="number"
            name="igdbId"
            value={igdbId}
            placeholder="Enter IGDB id"
            onChange={handleInputChange}
          />
        </Form.Group>
        <Button variant="primary" type="submit" className="submit-btn">
          Submit
        </Button>
      </Form>
    </div>
  );
};

export default GameForm;
