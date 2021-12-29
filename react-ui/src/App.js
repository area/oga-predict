import React, { useCallback, useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import NavDropdown from 'react-bootstrap/NavDropdown';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from "react-router-dom";

import About from './About'
import Home from './Home'
import OGAList from './OGAList'
import AddGame from './AddGame'
import EditGame from './EditGame'
import Predict from './Predict'
import Leaderboard from './Leaderboard'

function App() {

  const [username, setUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchData = useCallback(() => {
    fetch("/account")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        if (json.username){
          setUsername(`${json.username}#${json.discriminator}`);
          setIsAdmin(json.admin);
        }
      }).catch(e => {
        console.log(e);
      })
  });

  useEffect(() => {
    fetchData();
  });

  return (
    <div className="App text-light">
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">OGA Prediction League</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/leaderboard">Leaderboard</Nav.Link>
              <Nav.Link as={Link} to="/about">About</Nav.Link>
              <Nav.Link as={Link} to="/predict">Predict</Nav.Link>
              <Nav.Link as={Link} to="/the-list">The List</Nav.Link>
              { isAdmin ? <NavDropdown title="Admin" id="basic-nav-dropdown">
                <NavDropdown.Item as={Link} to="/game/add">Add Game</NavDropdown.Item>
                </NavDropdown> : "" }
            </Nav>
          </Navbar.Collapse>
              <Navbar.Collapse className="justify-content-end">
            <Navbar.Text>
              { username ? `Logged in as ${username}` : <a href="/login">Login via Discord</a> }
            </Navbar.Text>
          </Navbar.Collapse>
        </Container>
      </Navbar>      
    <div className="row">
    <div className="col-2" ></div>
    <div className="text-start col-8">

      {/* A <Routes> looks through its children <Route>s and
          renders the first one that matches the current URL. */}
      <Container className="pt-3">
      <Routes>
        <Route path="/about" element={<About/>} />
      </Routes>        
      <Routes>
        <Route path="/" element={<Home/>} />
      </Routes>        
      <Routes>
        <Route path="/the-list" element={<OGAList isAdmin={isAdmin} />} />
      </Routes>        
      <Routes>
        <Route path="/game/add" element={<AddGame isAdmin={isAdmin}/>} />
      </Routes>        
      <Routes>
        <Route path="/game/edit/:id" element={<EditGame isAdmin={isAdmin}/>} />
      </Routes>       
      <Routes>
        <Route path="/predict" element={<Predict isAdmin={isAdmin} username={username}/>} />
      </Routes>  
      <Routes>
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>    
      </Container>
    </div>
    </div>
    </Router>
    </div>
  );
}


export default App;
