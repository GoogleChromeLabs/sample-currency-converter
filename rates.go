/**
 *
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package currencyconverter

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"net/http"

	"google.golang.org/appengine"
	"google.golang.org/appengine/urlfetch"
)

// RateURL is the endpoint for European Central Bank rates.
const RateURL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

// Rate stores a single currency rate as a Go struct.
type Rate struct {
	Currency string  `xml:"currency,attr"`
	Rate     float32 `xml:"rate,attr"`
}

// Rates stores a list of rates. RateList is used for XML and RateMap for JSON.
type Rates struct {
	Base     string             `json:"base"`
	Date     string             `xml:"time,attr" json:"date"`
	RateList []Rate             `xml:"Cube" json:"-"`
	RateMap  map[string]float32 `xml:"-" json:"rates"`
}

// Envelope is used by the ECB to wrap the important data.
type Envelope struct {
	XMLName xml.Name `xml:"Envelope"`
	Rates   Rates    `xml:"Cube>Cube"`
}

func init() {
	http.HandleFunc("/rates", handler)
}

func handler(w http.ResponseWriter, r *http.Request) {
	ctx := appengine.NewContext(r)
	client := urlfetch.Client(ctx)

	// Fetch rates from ECB.
	resp, err := client.Get(RateURL)
	if err != nil {
		http.Error(w, "Error retrieving rates", 500)
		return
	}

	defer resp.Body.Close()

	// Read response body.
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Error reading rates", 500)
		return
	}

	x := Envelope{}

	// Unmarshal XML into Go struct.
	err = xml.Unmarshal(body, &x)
	if err != nil {
		http.Error(w, "Error parsing rates", 500)
		return
	}

	// Set Base.
	x.Rates.Base = "EUR"
	// Read RateList and populate RateMap.
	x.Rates.RateMap = make(map[string]float32)
	for _, rate := range x.Rates.RateList {
		x.Rates.RateMap[rate.Currency] = rate.Rate
	}

	// Serialize to JSON.
	j, err := json.Marshal(x.Rates)
	if err != nil {
		http.Error(w, "Error serializing to JSON", 500)
		return
	}

	// Success! Send JSON to client.
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=21600")
	fmt.Fprintf(w, "%v\n", string(j))
}
