import React, { useState, useCallback, useEffect } from 'react';
import PredictForm from './PredictForm';

function Predict(props) {

  const [predicts, setPredicts] = useState([]);
  const [myPredicts, setMyPredicts] = useState([]);

  const fetchData = useCallback(() => {
    fetch("/api/predictions/")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setPredicts(json)
      }).catch(e => {
        console.log(e);
      })

    fetch("/api/predictions/mine")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setMyPredicts(json)
      }).catch(e => {
        console.log(e);
      })
  });

  const handleOnSubmit = (game) => {
    console.log(JSON.stringify({...game}))
      fetch("/api/predict", {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({...game})
        });
  };

  useEffect(() => {
    fetchData();
  }, []);


  return <div> <h2 className="text-center mb-5">Prediction Page</h2>{predicts.length === 0 ? 
    <p className="text-center ">Nothing to predict right now</p> 
    : predicts.map( function(predict){ 
    return (
        <PredictForm handleOnSubmit={handleOnSubmit} game={predict} isAdmin={props.isAdmin} existingPredict={myPredicts.filter(v => v.gameid === predict.id)[0]?.prediction}/>
     );
    })}
    </div>

}

export default Predict;